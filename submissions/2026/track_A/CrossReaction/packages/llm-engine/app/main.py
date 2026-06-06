from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parents[3]
load_dotenv(ROOT_DIR / ".env")


class ProviderConfig(BaseModel):
    provider: Literal["local_openai_compatible"] = "local_openai_compatible"
    baseUrl: str = Field(default_factory=lambda: os.getenv("GEMMA_BASE_URL", "http://127.0.0.1:11434/v1"))
    apiKey: str = Field(default_factory=lambda: os.getenv("GEMMA_API_KEY", "local-placeholder-token"))
    model: str = Field(default_factory=lambda: os.getenv("GEMMA_MODEL", "gemma4:latest"))


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    provider: ProviderConfig
    messages: list[ChatMessage]
    temperature: float = 0.2
    maxTokens: int = 160
    timeoutSeconds: float = 30
    responseFormat: Literal["text", "json_object"] = "text"
    tools: list[dict[str, Any]] | None = None
    toolChoice: str | dict[str, Any] | None = None
    reasoningEffort: str | None = None


def extract_content(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {})
        content = message.get("content")
        if isinstance(content, str):
            if content.strip():
                return content
        reasoning = message.get("reasoning") or message.get("reasoning_content")
        if isinstance(reasoning, str) and reasoning.strip():
            return reasoning
    content = payload.get("content")
    return content if isinstance(content, str) else ""


def extract_tool_calls(payload: dict[str, Any]) -> list[dict[str, Any]]:
    # 中文：兼容 OpenAI /chat/completions 返回结构，优先提取 message.tool_calls 作为原生函数调用证据。
    # EN: Supports the OpenAI /chat/completions shape and prioritizes message.tool_calls as native function-calling evidence.
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {})
        tool_calls = message.get("tool_calls")
        if isinstance(tool_calls, list):
            return [tool_call for tool_call in tool_calls if isinstance(tool_call, dict)]
    tool_calls = payload.get("tool_calls")
    if isinstance(tool_calls, list):
        return [tool_call for tool_call in tool_calls if isinstance(tool_call, dict)]
    return []


app = FastAPI(title="Gemma Bioinformatics Demo LLM Adapter", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "service": "gemma-demo-llm-engine"}


@app.post("/test-provider")
async def test_provider(request: dict[str, Any]) -> dict[str, Any]:
    provider = ProviderConfig(**request.get("provider", {}))
    try:
        base_url = provider.baseUrl.rstrip("/")
        async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
            response = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {provider.apiKey}"},
            )
            response.raise_for_status()
        return {"ok": True, "message": "Model endpoint responded to /models."}
    except Exception as exc:  # noqa: BLE001 - user-facing diagnostic in demo adapter
        return {"ok": False, "message": str(exc)}


@app.post("/chat")
async def chat(request: ChatRequest) -> dict[str, Any]:
    provider = request.provider
    base_url = provider.baseUrl.rstrip("/")
    payload = {
        "model": provider.model,
        "messages": [message.model_dump() for message in request.messages],
        "temperature": request.temperature,
        "max_tokens": request.maxTokens,
        "stream": False,
    }
    if request.responseFormat == "json_object":
        payload["response_format"] = {"type": "json_object"}
    # 中文：tools/tool_choice/reasoning_effort 原样透传给本地 OpenAI-compatible Gemma 4 端点。
    # EN: tools/tool_choice/reasoning_effort are passed through unchanged to the local OpenAI-compatible Gemma 4 endpoint.
    if request.tools:
        payload["tools"] = request.tools
    if request.toolChoice is not None:
        payload["tool_choice"] = request.toolChoice
    if request.reasoningEffort:
        payload["reasoning_effort"] = request.reasoningEffort

    try:
        async with httpx.AsyncClient(timeout=request.timeoutSeconds, trust_env=False) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {provider.apiKey}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # noqa: BLE001 - surface model connectivity issues to the API layer
        return {"content": "", "error": str(exc), "raw_model": provider.model}

    return {
        "content": extract_content(data),
        "tool_calls": extract_tool_calls(data),
        "raw_model": provider.model,
    }
