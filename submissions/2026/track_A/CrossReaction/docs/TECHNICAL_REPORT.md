# CrossReaction Gemma 4 Agent Technical Report / 技术报告

## 中文版本

### 1. 摘要
CrossReaction Lite Version for GDG Gemma 4 Hackathon 2026 是面向 Gemma 4 开发者大赛赛道 A 的公开评审项目。系统展示 Gemma 4 在本地或私有 OpenAI-compatible endpoint 中，通过 Native guided tool calling、任务级 Memory、公开工具调用记录和 Docker 可复现执行，把自然语言生物医学分析需求转化为可审计结果。

该提交使用公开 synthetic sample data、公开 workflow contract 和公开 Docker 工具链。评审范围限于本仓库提交内容，不涉及商业版 CrossReaction 平台的生产系统、真实客户数据、私有镜像或生产凭据。

### 2. 赛道 A 对齐
| 赛道关注点 | 实现 |
| --- | --- |
| Native Function Calling | LLM engine 透传 `tools`、`tool_choice`、`reasoning_effort`，API 捕获 OpenAI-compatible `tool_calls`。 |
| 多步规划 | Gemma 4 先调用 `select_workflow`；API 再执行 public catalog/data inspection、execution plan grounding、Docker execution、result reflection。 |
| Memory | `ReviewAgentMemory` 保存 prompt、模型名、workflow、comparison、安全规则、observed public files、tool call IDs。 |
| Tool Calling | `publicToolManifest.ts` 定义公开工具 schema；`tool-calls.json` 和 Web UI 展示调用来源、参数、状态和摘要。 |
| 本地/端侧部署 | 默认连接 Ollama OpenAI-compatible endpoint，分析工具通过本地 Docker 执行。 |
| 可审计性 | 每次任务写出 `agent-memory.json`、`tool-calls.json`、`agent-trace.json`、`report.md`。 |

### 3. 模型选择
系统默认使用：

```bash
GEMMA_BASE_URL=http://127.0.0.1:11434/v1
GEMMA_MODEL=gemma4:latest
```

项目不绑定某个具体 Gemma 4 量化版本。只要 endpoint 兼容 OpenAI chat completion，并最好支持 `tools`，即可替换 `GEMMA_MODEL`。在本提交的验证环境中，Ollama 的 `gemma4:latest` 对应 `gemma4:e4b-it-q4_K_M` build，Ollama 报告信息为：

- family: `gemma4`
- parameters: `8.0B`
- quantization: `Q4_K_M`
- context length: `131072`
- capabilities: completion, vision, audio, tools, thinking

验证过程中，多工具 auto mode 在完整链路中的耗时稳定性不如单工具 guided mode。因此 runtime 采用单阶段强制 `select_workflow` 的 Native guided tool calling，并由 API 基于公开 contract 记录后续 grounding 步骤。若 endpoint 不支持 native tool calling，系统会明确标记 `JSON fallback`。

### 4. 系统架构
```text
Web UI
  -> API server
    -> Review Agent Runtime
      -> LLM engine adapter
        -> Local/private Gemma 4 OpenAI-compatible endpoint
    -> Public workflow catalog
    -> Docker execution pipelines
  -> .review-data/jobs/<jobId>/ artifacts
```

组件说明：
- `packages/web`：React/Vite Web UI，展示 Conversation、Workflow presets、Agent state、Execution plan、Progress and results。
- `packages/api`：Express API，负责 provider 配置、conversation routing、Agent planning、workflow 执行、artifact 持久化。
- `packages/llm-engine`：Python FastAPI adapter，向 Gemma 4 endpoint 发送 OpenAI-compatible chat/tool calling 请求。
- `demo-data`：公开 synthetic sample datasets。
- `packages/api/tool-images`：评审工作流需要的本地 wrapper image build context。

### 5. Agent Loop
1. 用户输入自然语言分析需求。
2. API 初始化任务和 Agent Memory。
3. Review Agent 将 `select_workflow` tool schema 发送给 Gemma 4。
4. Gemma 4 返回 native `tool_calls`，选择 `bulk_rna_seq`、`single_cell_rna_seq` 或 `proteomics_lfq`。
5. API 校验 workflow key，只允许公开 workflow。
6. API 系统性记录 `inspect_sample_data` 和 `draft_execution_plan`，并将步骤 grounding 到公开 workflow contract。
7. API 执行 Docker pipeline。
8. Gemma 4 对计算结果做简短 reflection。
9. UI 和 artifacts 展示 Memory、Tool Calls、Trace、结果表和报告。

### 6. Memory 设计
`ReviewAgentMemory` 是任务级公开记忆，只记录评审需要看到的信息：

```ts
{
  prompt: string
  model: string
  selectedWorkflowKey?: string
  selectedWorkflowName?: string
  comparison?: string
  publicSafetyRules: string[]
  observedToyData: string[]
  toolCallIds: string[]
}
```

Memory 的作用：
- 便于评审确认模型选择的 workflow。
- 便于评审追踪工具调用如何影响 state。
- 记录公开 synthetic sample data 文件，便于评审确认数据来源。
- 记录安全约束，确保所有执行都限制在 public review boundary 内。

### 7. Tool Calling 与来源
每个 tool call 都带有 `origin`：

| Origin | 含义 |
| --- | --- |
| `model_native` | Gemma 4 通过 OpenAI-compatible native tool call 返回。 |
| `model_schema` | 模型未返回 native tool call，但按 tool schema 返回 JSON 参数。 |
| `system_grounding` | API 为了公开审计和 contract grounding 记录的系统步骤。 |
| `json_fallback` | Native tool calling 不可用时的 fallback 计划。 |

这能避免评审误解：并非所有 Tool Calls 都声称来自模型原生调用；UI 会清晰标注模型原生调用和系统 grounding 的边界。

### 8. 公开工具列表
- `inspect_available_workflows`
- `inspect_sample_data`
- `select_workflow`
- `draft_execution_plan`
- `summarize_results`

Gemma 4 当前在 planning 阶段原生调用 `select_workflow`。后续 sample inspection 和 execution plan grounding 由 API 基于公开 workflow contract 记录，保证结果稳定、可复现且边界受控。

### 9. Docker 执行
三个 workflow 都可在本地执行：
- Bulk RNA-seq：FastQC、Trimmomatic、kallisto、PyDESeq2、MultiQC。
- Single-cell RNA-seq：FastQC、fastp、Scanpy、limma。
- Label-free proteomics：OpenMS、limma、MSstats。

所有输入来自 `demo-data`，输出写入 `.review-data/jobs/<jobId>/`。详细步骤见 `docs/DOCKER_DEPLOYMENT.md`。

### 10. Fallback 策略
当模型 endpoint 不支持 native tool calling、返回空内容、JSON 被截断或请求超时时，系统不会中断评审流程，而是：
1. UI 显示 `JSON fallback`。
2. API 使用公开 JSON planner 或 deterministic fallback。
3. 所有 fallback 决策仍写入 trace 和 tool calls。
4. 后续执行仍被限制在公开 workflow catalog 和 synthetic sample data 内。

### 11. 隐私与边界
本提交范围不包括：
- 商业版 CrossReaction 平台的生产调度架构。
- 私有数据、客户数据、私有镜像。
- 生产凭据、真实 API keys、生产部署系统。
- `.agentdocs` 本地开发辅助文档。

提交包由 `scripts/package-submission.sh` 生成，并由 `scripts/check-review-package.sh` 扫描边界。

### 12. 验证
```bash
pnpm build
pnpm --filter @gemma-demo/api test
pnpm check
```

`pnpm check` 会构建、测试、生成提交包并在提交包中运行边界扫描。

### 13. 已知限制
- 本项目是公开评审提交，不是商业生产系统。
- Native tool calling 能力依赖评审环境中的 Gemma 4 endpoint；不支持时会进入可见 fallback。
- Synthetic sample datasets 很小，只用于可复现技术演示，不代表真实科研结论。

---

## English Version

### 1. Summary
CrossReaction Lite Version for GDG Gemma 4 Hackathon 2026 is a public review project for Gemma 4 Track A. It demonstrates how Gemma 4, running behind a local or private OpenAI-compatible endpoint, can use Native guided tool calling, task-scoped Memory, visible Tool Calls, and local Docker execution to turn a natural-language biomedical analysis request into auditable outputs.

This submission uses public synthetic sample data, public workflow contracts, and public Docker tools. The review scope is limited to the submitted repository contents and does not include production CrossReaction systems, real customer data, private images, or production credentials.

### 2. Track A Alignment
| Track Focus | Implementation |
| --- | --- |
| Native Function Calling | The LLM engine passes `tools`, `tool_choice`, and `reasoning_effort`; the API captures OpenAI-compatible `tool_calls`. |
| Multi-step planning | Gemma 4 calls `select_workflow`; the API performs public catalog/data inspection, execution-plan grounding, Docker execution, and result reflection. |
| Memory | `ReviewAgentMemory` stores prompt, model, workflow, comparison, safety rules, observed public files, and tool call IDs. |
| Tool Calling | `publicToolManifest.ts` defines public tool schemas; `tool-calls.json` and the Web UI show origin, arguments, status, and summary. |
| Local/private deployment | The default setup connects to Ollama's OpenAI-compatible endpoint and runs computation locally through Docker. |
| Auditability | Each task writes `agent-memory.json`, `tool-calls.json`, `agent-trace.json`, and `report.md`. |

### 3. Model Choice
The default configuration is:

```bash
GEMMA_BASE_URL=http://127.0.0.1:11434/v1
GEMMA_MODEL=gemma4:latest
```

The project is not tied to a specific Gemma 4 quantization tag. Any OpenAI-compatible chat endpoint can be used, preferably with `tools` support. In the validation environment for this submission, Ollama maps `gemma4:latest` to the `gemma4:e4b-it-q4_K_M` build, reported as:

- family: `gemma4`
- parameters: `8.0B`
- quantization: `Q4_K_M`
- context length: `131072`
- capabilities: completion, vision, audio, tools, thinking

Validation showed that multi-tool auto mode can be less stable than guided single-tool mode in a full API chain. Therefore, the runtime uses a single guided native `select_workflow` stage, while the API records later grounding steps from public contracts. If the endpoint does not support native tool calling, the UI clearly marks `JSON fallback`.

### 4. Architecture
```text
Web UI
  -> API server
    -> Review Agent Runtime
      -> LLM engine adapter
        -> Local/private Gemma 4 OpenAI-compatible endpoint
    -> Public workflow catalog
    -> Docker execution pipelines
  -> .review-data/jobs/<jobId>/ artifacts
```

Components:
- `packages/web`: React/Vite Web UI for Conversation, Workflow presets, Agent state, Execution plan, Progress and results.
- `packages/api`: Express API for provider config, conversation routing, Agent planning, workflow execution, and artifact persistence.
- `packages/llm-engine`: Python FastAPI adapter for OpenAI-compatible Gemma 4 chat/tool calls.
- `demo-data`: public synthetic sample datasets.
- `packages/api/tool-images`: local wrapper image build context required by the review workflows.

### 5. Agent Loop
1. The user enters a natural-language analysis request.
2. The API initializes the task and Agent Memory.
3. The Review Agent sends the `select_workflow` tool schema to Gemma 4.
4. Gemma 4 returns native `tool_calls` to select `bulk_rna_seq`, `single_cell_rna_seq`, or `proteomics_lfq`.
5. The API validates the workflow key against the public catalog.
6. The API records `inspect_sample_data` and `draft_execution_plan` as system grounding steps from public workflow contracts.
7. The API executes the Docker pipeline.
8. Gemma 4 reflects on computed results.
9. The UI and artifacts show Memory, Tool Calls, Trace, result tables, and report.

### 6. Memory Design
`ReviewAgentMemory` is task-scoped public memory:

```ts
{
  prompt: string
  model: string
  selectedWorkflowKey?: string
  selectedWorkflowName?: string
  comparison?: string
  publicSafetyRules: string[]
  observedToyData: string[]
  toolCallIds: string[]
}
```

Memory helps reviewers verify:
- which workflow the model selected;
- how tool calls updated state;
- which public synthetic sample files were observed;
- which safety rules kept execution inside the public review boundary.

### 7. Tool Calling Origins
Each tool call has an `origin`:

| Origin | Meaning |
| --- | --- |
| `model_native` | Gemma 4 returned an OpenAI-compatible native tool call. |
| `model_schema` | The model returned JSON arguments according to a tool schema, without native `tool_calls`. |
| `system_grounding` | The API recorded a system step for public contract grounding and auditability. |
| `json_fallback` | The fallback planner was used because native tool calling was unavailable. |

This avoids overstating the model behavior: the UI distinguishes native model calls from system grounding steps.

### 8. Public Tools
- `inspect_available_workflows`
- `inspect_sample_data`
- `select_workflow`
- `draft_execution_plan`
- `summarize_results`

Gemma 4 currently performs the native `select_workflow` call during planning. Sample inspection and plan grounding are then recorded by the API from public workflow contracts for stability, reproducibility, and boundary control.

### 9. Docker Execution
All three workflows are executable locally:
- Bulk RNA-seq: FastQC, Trimmomatic, kallisto, PyDESeq2, MultiQC.
- Single-cell RNA-seq: FastQC, fastp, Scanpy, limma.
- Label-free proteomics: OpenMS, limma, MSstats.

Inputs come from `demo-data`; outputs are written under `.review-data/jobs/<jobId>/`. See `docs/DOCKER_DEPLOYMENT.md` for detailed deployment steps.

### 10. Fallback Strategy
If the endpoint does not support native tool calling, returns empty content, truncates JSON, or times out:
1. The UI marks `JSON fallback`.
2. The API uses a public JSON planner or deterministic fallback.
3. Fallback decisions are still written to trace and tool calls.
4. Execution remains constrained to the public workflow catalog and synthetic sample data.

### 11. Privacy Boundary
The submission scope excludes:
- production orchestration architecture from the commercial CrossReaction platform;
- private data, customer data, private images;
- production credentials, real API keys, production deployment systems;
- local development assistant documentation under `.agentdocs`.

The submission package is generated by `scripts/package-submission.sh` and scanned by `scripts/check-review-package.sh`.

### 12. Validation
```bash
pnpm build
pnpm --filter @gemma-demo/api test
pnpm check
```

`pnpm check` builds, tests, creates a clean submission package, and runs the boundary scanner inside that package.

### 13. Known Limitations
- This is a public review submission, not a commercial production system.
- Native tool calling depends on the Gemma 4 endpoint available in the review environment; unsupported endpoints fall back visibly.
- Synthetic sample datasets are intentionally small and are not scientific claims.
