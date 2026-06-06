import fs from 'node:fs/promises'
import path from 'node:path'
import { requestModelChatWithTools, requestModelPlan, type ChatToolCall } from './llmClient.js'
import { reviewDataRoot } from './paths.js'
import { publicToolDefinitions, type PublicToolDefinition, type PublicToolName } from './publicToolManifest.js'
import {
  assertPublicToolName,
  publicWorkflowOrThrow,
  sanitizePublicText,
  workflowSummaryForPublicTrace,
} from './reviewAgentGuards.js'
import type {
  ModelPlan,
  PlannedStep,
  ProviderConfig,
  ReviewAgentMemory,
  ReviewAgentRun,
  ReviewAgentTraceEntry,
  ReviewToolCall,
} from './types.js'

export type ReviewAgentModelCaller = typeof requestModelChatWithTools

type ExecutedPublicTool = {
  call: ReviewToolCall
  result: Record<string, unknown>
  native: boolean
}

type GuidedToolStep = {
  name: PublicToolName
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}

function now() {
  return new Date().toISOString()
}

function traceEntry(
  id: string,
  stage: ReviewAgentTraceEntry['stage'],
  status: ReviewAgentTraceEntry['status'],
  title: string,
  detail?: string,
): ReviewAgentTraceEntry {
  return {
    id,
    stage,
    status,
    title,
    detail: detail ? sanitizePublicText(detail) : undefined,
    timestamp: now(),
  }
}

function initializeMemory(prompt: string, provider: ProviderConfig): ReviewAgentMemory {
  // 中文：任务级 Memory 只记录公开可审计状态，包括模型、输入、选择的 workflow、观察到的公开样例文件和工具调用 ID。
  // EN: Task-level memory stores only public auditable state: model, prompt, selected workflow, observed public sample files, and tool-call IDs.
  return {
    prompt: sanitizePublicText(prompt),
    model: provider.model,
    publicSafetyRules: [
      'Use only public toy data included in this review repository.',
      'Use only public workflow contracts and public container images listed by the demo.',
      'Do not use private CrossReaction platform internals, private data, private images, or production credentials.',
      'Ground all visible execution steps against the public workflow catalog before execution.',
    ],
    observedToyData: [],
    toolCallIds: [],
  }
}

function parseToolArguments(raw: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  if (!raw.trim()) return {}
  const parsed = JSON.parse(raw)
  return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
}

function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('No JSON object found in guided tool response.')
  }
  const parsed = JSON.parse(candidate.slice(start, end + 1))
  return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
}

function normalizeToolCall(toolCall: ChatToolCall, index: number): ReviewToolCall {
  const name = String(toolCall.function?.name || '')
  assertPublicToolName(name)
  return {
    id: toolCall.id || `tool-call-${index + 1}`,
    name,
    origin: 'model_native',
    arguments: parseToolArguments(toolCall.function?.arguments),
    status: 'requested',
    timestamp: now(),
  }
}

function toolDefinition(name: PublicToolName): PublicToolDefinition {
  const definition = publicToolDefinitions.find((tool) => tool.function.name === name)
  if (!definition) throw new Error(`Public tool definition not found: ${name}`)
  return definition
}

function compactSteps(steps: PlannedStep[]) {
  return steps.map((step) => ({
    id: step.id,
    title: step.title,
    toolName: step.toolName || 'not specified',
    toolImage: step.toolImage || 'not specified',
  }))
}

function executePublicTool(name: PublicToolName, args: Record<string, unknown>) {
  if (name === 'inspect_available_workflows') {
    return {
      workflows: workflowSummaryForPublicTrace(),
    }
  }

  if (name === 'inspect_sample_data') {
    const workflow = publicWorkflowOrThrow(args.workflowKey)
    return {
      workflowKey: workflow.key,
      label: workflow.sampleData.label,
      description: workflow.sampleData.description,
      files: workflow.sampleData.files,
      compliance: 'Synthetic public-style toy data included for review reproduction.',
    }
  }

  if (name === 'select_workflow') {
    const workflow = publicWorkflowOrThrow(args.workflowKey)
    return {
      workflowKey: workflow.key,
      workflowName: workflow.name,
      reason: sanitizePublicText(args.reason),
      comparison: sanitizePublicText(args.comparison || 'condition comparison'),
    }
  }

  if (name === 'draft_execution_plan') {
    const workflow = publicWorkflowOrThrow(args.workflowKey)
    return {
      workflowKey: workflow.key,
      intent: sanitizePublicText(args.intent || workflow.description),
      comparison: sanitizePublicText(args.comparison || 'condition comparison'),
      steps: compactSteps(workflow.steps),
      caveat: 'Execution is restricted to the public review workflow contract.',
    }
  }

  if (name === 'summarize_results') {
    const workflow = publicWorkflowOrThrow(args.workflowKey)
    return {
      workflowKey: workflow.key,
      summary: sanitizePublicText(args.compactResult || `Public ${workflow.name} result is ready for review.`),
      caveat: 'Interpretation is based on public toy data, not clinical or production data.',
    }
  }

  throw new Error(`Unsupported public review tool: ${name}`)
}

function updateMemoryFromTool(memory: ReviewAgentMemory, tool: ExecutedPublicTool) {
  // 中文：每个工具执行结果都会回写 Memory，让评审能追踪 tool call 如何改变 Agent 状态。
  // EN: Every executed tool writes back into memory, making tool-call state changes traceable for reviewers.
  memory.toolCallIds.push(tool.call.id)

  if (tool.call.name === 'inspect_sample_data' && Array.isArray(tool.result.files)) {
    memory.observedToyData = Array.from(new Set([
      ...memory.observedToyData,
      ...tool.result.files.map((file) => String(file)),
    ]))
  }

  if (tool.call.name === 'select_workflow') {
    memory.selectedWorkflowKey = String(tool.result.workflowKey || '')
    memory.selectedWorkflowName = String(tool.result.workflowName || '')
    memory.comparison = String(tool.result.comparison || '')
  }

  if (tool.call.name === 'draft_execution_plan') {
    memory.selectedWorkflowKey = String(tool.result.workflowKey || memory.selectedWorkflowKey || '')
    memory.comparison = String(tool.result.comparison || memory.comparison || '')
  }
}

function executeNativeToolCall(
  toolCall: ChatToolCall,
  index: number,
  origin: ReviewToolCall['origin'] = 'model_native',
): ExecutedPublicTool {
  const call = normalizeToolCall(toolCall, index)
  const result = executePublicTool(call.name as PublicToolName, call.arguments)
  return {
    call: {
      ...call,
      origin,
      status: 'completed',
      resultSummary: sanitizePublicText(JSON.stringify(result).slice(0, 500)),
    },
    result,
    native: true,
  }
}

async function callGuidedTool(
  provider: ProviderConfig,
  modelCaller: ReviewAgentModelCaller,
  step: GuidedToolStep,
  index: number,
): Promise<ExecutedPublicTool> {
  // 中文：这里强制 Gemma 4 调用指定公开函数；若兼容端点返回 schema JSON 而非原生 tool_calls，会标记为 model_schema。
  // EN: This stage forces Gemma 4 to call one public function; schema JSON responses are kept but marked as model_schema instead of native tool_calls.
  const response = await modelCaller(
    provider,
    step.messages,
    [toolDefinition(step.name)],
    { type: 'function', function: { name: step.name } },
  )
  if (response.error) {
    throw new Error(`${step.name} failed: ${response.error}`)
  }
  if (!response.toolCalls.length) {
    if (!response.content.trim()) {
      throw new Error(`${step.name} returned no native tool call.`)
    }
    const args = extractJsonObject(response.content)
    const call: ChatToolCall = {
      id: `guided-${step.name}-${index + 1}`,
      type: 'function',
      function: {
        name: step.name,
        arguments: JSON.stringify(args),
      },
    }
    return { ...executeNativeToolCall(call, index, 'model_schema'), native: false }
  }
  const matchingCall = response.toolCalls.find((toolCall) => toolCall.function?.name === step.name) || response.toolCalls[0]
  return executeNativeToolCall(matchingCall, index)
}

function buildPlanFromToolResults(
  provider: ProviderConfig,
  prompt: string,
  toolResults: ExecutedPublicTool[],
  agentRun: ReviewAgentRun,
  rawResponse: string,
): ModelPlan {
  // 中文：最终执行计划不直接信任模型文本，而是由已执行的公开工具结果和 workflow contract 组装。
  // EN: The final execution plan is assembled from executed public tool results and workflow contracts, not from free-form model text.
  const selected = toolResults.find((tool) => tool.call.name === 'select_workflow')
  const drafted = toolResults.find((tool) => tool.call.name === 'draft_execution_plan')
  const workflowKey = String(selected?.result.workflowKey || drafted?.result.workflowKey || '')
  const workflow = publicWorkflowOrThrow(workflowKey)
  const intent = sanitizePublicText(drafted?.result.intent || selected?.call.arguments.reason || workflow.description)
  const comparison = sanitizePublicText(selected?.result.comparison || drafted?.result.comparison || 'condition comparison')

  return {
    intent: intent || workflow.description,
    comparison: comparison || (workflow.key === 'bulk_rna_seq' ? 'treatment vs control' : 'condition comparison'),
    model: provider.model,
    rawResponse,
    source: 'model',
    sourceMessage: agentRun.mode === 'native_guided_tool_calling'
      ? 'Gemma 4 used guided native tool calling; executable steps were grounded against public workflow contracts.'
      : agentRun.mode === 'guided_tool_calling'
        ? 'Gemma 4 used guided tool-schema planning; executable steps were grounded against public workflow contracts.'
        : 'Gemma 4 used public review tool calling; executable steps were grounded against public workflow contracts.',
    trace: [
      {
        id: 'review-agent-tool-calling',
        status: 'completed',
        title: agentRun.mode === 'native_guided_tool_calling' ? 'Guided native tool calling captured' : 'Native tool calling captured',
        detail: `${agentRun.toolCalls.length} public review tool calls were recorded.`,
        timestamp: now(),
      },
    ],
    workflowKey: workflow.key,
    workflowName: workflow.name,
    executionMode: workflow.executionMode,
    executionNote: workflow.executionNote,
    sampleData: workflow.sampleData,
    steps: workflow.steps,
    agentRun,
  }
}

function fallbackAgentRun(provider: ProviderConfig, prompt: string, reason: string, modelPlan: ModelPlan): ReviewAgentRun {
  // 中文：fallback 是显式审计路径，保留 json-fallback-plan 记录，避免把非原生调用伪装成 native tool calling。
  // EN: Fallback is an explicit audit path with a json-fallback-plan record, so non-native planning is not presented as native tool calling.
  const memory = initializeMemory(prompt, provider)
  if (modelPlan.workflowKey) {
    memory.selectedWorkflowKey = modelPlan.workflowKey
    memory.selectedWorkflowName = modelPlan.workflowName
  }
  memory.comparison = modelPlan.comparison
  memory.observedToyData = modelPlan.sampleData?.files || []
  const fallbackToolCall: ReviewToolCall = {
    id: 'json-fallback-plan',
    name: 'json_fallback_plan',
    origin: 'json_fallback',
    arguments: {
      workflowKey: modelPlan.workflowKey || 'unknown',
      comparison: modelPlan.comparison,
      reason: sanitizePublicText(reason),
    },
    status: 'completed',
    resultSummary: sanitizePublicText(modelPlan.sourceMessage || 'Fallback public workflow plan selected.'),
    timestamp: now(),
  }
  memory.toolCallIds = [fallbackToolCall.id]
  return {
    mode: 'json_fallback',
    model: provider.model,
    memory,
    toolCalls: [fallbackToolCall],
    trace: [
      traceEntry('fallback-start', 'understand', 'completed', 'Use JSON fallback planner', reason),
      traceEntry('fallback-ground', 'ground', 'completed', 'Ground fallback plan to public workflow contract', modelPlan.workflowName || modelPlan.workflowKey || 'default workflow'),
    ],
  }
}

function deterministicFallbackPlan(provider: ProviderConfig, prompt: string, reason: string): ModelPlan {
  const lower = prompt.toLowerCase()
  const workflow = lower.includes('single-cell') || lower.includes('single cell') || lower.includes('scanpy')
    ? publicWorkflowOrThrow('single_cell_rna_seq')
    : lower.includes('proteomics') || lower.includes('protein') || lower.includes('lfq')
      ? publicWorkflowOrThrow('proteomics_lfq')
      : publicWorkflowOrThrow('bulk_rna_seq')
  const comparison = workflow.key === 'bulk_rna_seq' || lower.includes('treatment')
    ? 'treatment vs control'
    : 'condition comparison'
  const basePlan: ModelPlan = {
    intent: workflow.description,
    comparison,
    model: provider.model,
    rawResponse: '',
    source: 'fallback',
    sourceMessage: `Deterministic public workflow fallback was used after model planning failed: ${sanitizePublicText(reason)}`,
    workflowKey: workflow.key,
    workflowName: workflow.name,
    executionMode: workflow.executionMode,
    executionNote: workflow.executionNote,
    sampleData: workflow.sampleData,
    steps: workflow.steps,
  }
  const agentRun = fallbackAgentRun(provider, prompt, reason, basePlan)
  return { ...basePlan, agentRun }
}

export async function requestReviewAgentPlan(
  provider: ProviderConfig,
  prompt: string,
  modelCaller: ReviewAgentModelCaller = requestModelChatWithTools,
): Promise<ModelPlan> {
  if (process.env.DEMO_SKIP_REVIEW_AGENT === '1') {
    const fallbackPlan = await requestModelPlan(provider, prompt)
    const agentRun = fallbackAgentRun(provider, prompt, 'Review agent was skipped by DEMO_SKIP_REVIEW_AGENT.', fallbackPlan)
    return { ...fallbackPlan, agentRun }
  }

  const memory = initializeMemory(prompt, provider)
  const trace: ReviewAgentTraceEntry[] = [
    traceEntry('understand-request', 'understand', 'completed', 'Read public analysis request', `Prompt length: ${prompt.trim().length} characters.`),
    traceEntry('inspect-workflows', 'ground', 'completed', 'Inspect public workflow catalog', `${workflowSummaryForPublicTrace().length} public workflows available for guided tool calling.`),
    traceEntry('select-workflow', 'plan', 'running', 'Ask Gemma 4 to select one public workflow', 'The select_workflow tool is required for this guided native tool-calling stage.'),
  ]

  try {
    // 中文：多步规划顺序为理解请求、原生选择 workflow、系统 grounding 样例数据、系统 grounding 执行计划、再交给 API 执行。
    // EN: Multi-step planning flows through request understanding, native workflow selection, system grounding of sample data, system grounding of the execution plan, then API execution.
    const selectedTool = await callGuidedTool(provider, modelCaller, {
      name: 'select_workflow',
      messages: [
        {
          role: 'system',
          content: 'Use the required select_workflow tool. Return only the function call.',
        },
        { role: 'user', content: prompt },
      ],
    }, 0)
    updateMemoryFromTool(memory, selectedTool)
    trace.push(traceEntry('select-workflow', 'plan', 'completed', 'Gemma 4 selected a public workflow', selectedTool.call.resultSummary))

    const workflow = publicWorkflowOrThrow(selectedTool.result.workflowKey)
    const sampleTool: ExecutedPublicTool = {
      call: {
        id: 'system-inspect-sample-data',
        name: 'inspect_sample_data',
        origin: 'system_grounding',
        arguments: { workflowKey: workflow.key },
        status: 'completed',
        resultSummary: `Observed ${workflow.sampleData.files.length} public sample files for ${workflow.name}.`,
        timestamp: now(),
      },
      result: executePublicTool('inspect_sample_data', { workflowKey: workflow.key }),
      native: false,
    }
    updateMemoryFromTool(memory, sampleTool)
    trace.push(traceEntry('inspect-sample-data', 'ground', 'completed', 'Inspect selected public toy data', sampleTool.call.resultSummary))

    const draftArguments = {
      workflowKey: workflow.key,
      intent: sanitizePublicText(selectedTool.call.arguments.reason || workflow.description),
      comparison: memory.comparison || 'condition comparison',
      requestedOutputs: ['QC', 'matrix or quantification', 'differential summary', 'report'],
    }
    const draftedTool: ExecutedPublicTool = {
      call: {
        id: 'system-draft-execution-plan',
        name: 'draft_execution_plan',
        origin: 'system_grounding',
        arguments: draftArguments,
        status: 'completed',
        resultSummary: `Grounded execution plan from public ${workflow.name} contract.`,
        timestamp: now(),
      },
      result: executePublicTool('draft_execution_plan', draftArguments),
      native: false,
    }
    updateMemoryFromTool(memory, draftedTool)
    trace.push(traceEntry('draft-plan', 'plan', 'completed', 'Draft execution plan from public workflow contract', draftedTool.call.resultSummary))

    const executedTools = [selectedTool, sampleTool, draftedTool]
    const modelGuidedTools = [selectedTool]
    const failedTool = executedTools.find((tool) => tool.call.status === 'failed')
    if (failedTool) {
      throw new Error(failedTool.call.resultSummary || 'Guided native tool call failed.')
    }

    trace.push(traceEntry('ground-tools', 'ground', 'completed', 'Ground guided tool calls to public workflow contracts', memory.selectedWorkflowName || memory.selectedWorkflowKey || 'workflow selected'))
    trace.push(traceEntry('execute-ready', 'execute', 'completed', 'Public workflow ready for controlled execution', 'Execution will be performed by the API against public Docker workflows.'))
    trace.push(traceEntry('reflect-pending', 'reflect', 'completed', 'Result reflection will run after tool execution', 'The model will summarize computed public results after Docker execution.'))

    const agentRun: ReviewAgentRun = {
      mode: modelGuidedTools.every((tool) => tool.native) ? 'native_guided_tool_calling' : 'guided_tool_calling',
      model: provider.model,
      memory,
      toolCalls: executedTools.map((tool) => tool.call),
      trace,
    }

    return buildPlanFromToolResults(provider, prompt, executedTools, agentRun, [
      JSON.stringify(selectedTool.call.arguments),
      JSON.stringify(draftArguments),
    ].join('\n'))
  } catch (error) {
    trace.push(traceEntry(
      'guided-native-failed',
      'plan',
      'failed',
      'Guided native tool calling failed',
      error instanceof Error ? error.message : 'Guided native tool calling failed.',
    ))
    const reason = error instanceof Error ? error.message : 'Guided native tool calling failed.'
    const fallbackPlan = await requestModelPlan(provider, prompt)
    if (fallbackPlan.source === 'failed') {
      return deterministicFallbackPlan(provider, prompt, fallbackPlan.sourceMessage || reason)
    }
    const agentRun = fallbackAgentRun(provider, prompt, reason, fallbackPlan)
    agentRun.trace = [...trace, ...agentRun.trace]
    return { ...fallbackPlan, agentRun }
  }
}

export async function persistReviewAgentArtifacts(jobId: string, agentRun?: ReviewAgentRun): Promise<ReviewAgentRun | undefined> {
  if (!agentRun) return undefined
  // 中文：持久化 Memory、Tool Calls 和 Trace，便于评审截图或直接打开 JSON artifact 复核。
  // EN: Memory, tool calls, and trace are persisted so reviewers can screenshot or inspect JSON artifacts directly.
  const outputDir = path.join(reviewDataRoot, 'jobs', jobId)
  await fs.mkdir(outputDir, { recursive: true })
  const artifactPaths = {
    memory: path.join(outputDir, 'agent-memory.json'),
    toolCalls: path.join(outputDir, 'tool-calls.json'),
    trace: path.join(outputDir, 'agent-trace.json'),
  }
  await fs.writeFile(artifactPaths.memory, JSON.stringify(agentRun.memory, null, 2))
  await fs.writeFile(artifactPaths.toolCalls, JSON.stringify(agentRun.toolCalls, null, 2))
  await fs.writeFile(artifactPaths.trace, JSON.stringify(agentRun.trace, null, 2))
  return {
    ...agentRun,
    artifactPaths,
  }
}
