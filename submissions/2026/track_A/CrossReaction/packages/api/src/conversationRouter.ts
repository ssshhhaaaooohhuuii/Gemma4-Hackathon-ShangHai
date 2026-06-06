import type { ConversationDecision, ProviderConfig, TaskRecord } from './types.js'
import { workflowCatalog, type WorkflowKey } from './workflowCatalog.js'

const llmEngineUrl = process.env.LLM_ENGINE_URL || 'http://127.0.0.1:8011'

const workflowAliases: Array<{ key: WorkflowKey; patterns: RegExp[] }> = [
  {
    key: 'single_cell_rna_seq',
    patterns: [
      /single[-\s]?cell/i,
      /\bscRNA\b/i,
      /单细胞/i,
    ],
  },
  {
    key: 'proteomics_lfq',
    patterns: [
      /proteomics/i,
      /label[-\s]?free/i,
      /\blfq\b/i,
      /蛋白组|非标记/i,
    ],
  },
  {
    key: 'bulk_rna_seq',
    patterns: [
      /\bbulk\b/i,
      /\brna[-\s]?seq\b/i,
      /转录组|bulk\s*RNA|RNA测序/i,
    ],
  },
]

const directExecutePatterns = [
  /\b(run|start|execute|process|perform|launch)\b/i,
  /开始|运行|执行|启动|跑一下|做一下/,
]

const planningExecutePatterns = [
  /\b(analy[sz]e|plan)\b/i,
  /分析|规划|处理|生成计划/,
]

const imperativeExecutePatterns = [
  /\bplease\s+(run|start|execute|process|perform|launch|analy[sz]e|plan)\b/i,
  /请(开始|运行|执行|启动|分析|规划|处理)|现在(开始|运行|执行|启动|分析|规划|处理)|直接(开始|运行|执行|启动|分析|规划|处理)/,
]

const statusPatterns = [
  /\b(status|progress|result|timeline|finished|done|running)\b/i,
  /状态|进度|结果|完成了吗|跑完|运行中|当前任务/,
]

const questionPatterns = [
  /\?|？/,
  /\b(what|why|how|can you|could you|explain|tell me|support|available)\b/i,
  /什么|为什么|如何|怎么|能否|可以吗|支持|解释|介绍|区别|有哪些/,
]

function detectWorkflowKey(message: string): WorkflowKey | undefined {
  return workflowAliases.find((workflow) => workflow.patterns.some((pattern) => pattern.test(message)))?.key
}

function workflowName(key?: WorkflowKey) {
  return workflowCatalog.find((workflow) => workflow.key === key)?.name
}

function supportedWorkflowText() {
  return workflowCatalog.map((workflow) => workflow.name).join(', ')
}

function normalizePrompt(message: string, workflowKey?: WorkflowKey) {
  const trimmed = message.trim()
  if (!workflowKey) return trimmed
  const workflow = workflowCatalog.find((item) => item.key === workflowKey)
  if (!workflow) return trimmed
  return trimmed || `Plan and run ${workflow.name} using the included public toy data.`
}

export function routeConversationByRules(
  message: string,
  context: { hasActiveTask?: boolean; latestTaskStatus?: TaskRecord['status'] } = {},
): ConversationDecision | undefined {
  const text = message.trim()
  if (!text) {
    return {
      action: 'clarify',
      confidence: 1,
      source: 'fast_rule',
      message: 'Please describe the analysis question or ask what this demo can do.',
      reason: 'empty message',
    }
  }

  if (statusPatterns.some((pattern) => pattern.test(text))) {
    const statusText = context.latestTaskStatus
      ? `The latest task is ${context.latestTaskStatus}.`
      : 'No task has been started in this browser session yet.'
    return {
      action: 'status',
      confidence: 0.92,
      source: 'fast_rule',
      message: statusText,
      reason: 'status request',
    }
  }

  const workflowKey = detectWorkflowKey(text)
  const asksQuestion = questionPatterns.some((pattern) => pattern.test(text))
  const asksDirectExecution = directExecutePatterns.some((pattern) => pattern.test(text))
  const asksPlanningExecution = planningExecutePatterns.some((pattern) => pattern.test(text))
  const asksImperativeExecution = imperativeExecutePatterns.some((pattern) => pattern.test(text))
  const asksExecution = asksImperativeExecution || (!asksQuestion && (asksDirectExecution || asksPlanningExecution))

  if (asksExecution && context.hasActiveTask) {
    return {
      action: 'status',
      confidence: 0.9,
      source: 'fast_rule',
      message: 'A task is already running. Wait for it to finish before starting another workflow.',
      reason: 'active task prevents new execution',
    }
  }

  if (asksExecution && workflowKey && !context.hasActiveTask) {
    return {
      action: 'run_analysis',
      confidence: 0.9,
      source: 'fast_rule',
      message: `Starting ${workflowName(workflowKey)} with the public review workflow.`,
      workflowKey,
      analysisPrompt: normalizePrompt(text, workflowKey),
      reason: 'explicit workflow execution request',
    }
  }

  if (asksExecution && !workflowKey) {
    return {
      action: 'clarify',
      confidence: 0.86,
      source: 'fast_rule',
      message: `Which public workflow should I use: ${supportedWorkflowText()}?`,
      reason: 'execution requested without workflow',
    }
  }

  if (asksQuestion) {
    return {
      action: 'answer',
      confidence: 0.78,
      source: 'fast_rule',
      message: workflowKey
        ? `${workflowName(workflowKey)} is available in this public demo. I will only start execution after you explicitly ask me to run it.`
        : `This demo can discuss and run three public workflows: ${supportedWorkflowText()}. Ask me to run one when you want execution to start.`,
      workflowKey,
      reason: 'general question',
    }
  }

  if (workflowKey && !asksExecution) {
    return {
      action: 'clarify',
      confidence: 0.82,
      source: 'fast_rule',
      message: `I recognized ${workflowName(workflowKey)}. Tell me to run or analyze it when you want me to start the workflow.`,
      workflowKey,
      reason: 'workflow mentioned without execution intent',
    }
  }

  return undefined
}

function parseDecision(raw: string): Partial<ConversationDecision> {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return {}
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Partial<ConversationDecision>
  } catch {
    return {}
  }
}

function normalizeDecision(candidate: Partial<ConversationDecision>, message: string): ConversationDecision {
  const allowedActions = new Set<ConversationDecision['action']>(['answer', 'clarify', 'status', 'run_analysis'])
  const action = allowedActions.has(candidate.action as ConversationDecision['action'])
    ? candidate.action as ConversationDecision['action']
    : 'clarify'
  const workflowKey = candidate.workflowKey && workflowCatalog.some((workflow) => workflow.key === candidate.workflowKey)
    ? candidate.workflowKey as WorkflowKey
    : detectWorkflowKey(message)

  return {
    action,
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence ?? 0.55))),
    source: 'model',
    message: String(candidate.message || 'I can help discuss the request, or start a public workflow after you explicitly ask me to run it.'),
    reason: typeof candidate.reason === 'string' ? candidate.reason : undefined,
    workflowKey,
    analysisPrompt: action === 'run_analysis'
      ? normalizePrompt(String(candidate.analysisPrompt || message), workflowKey)
      : undefined,
  }
}

export async function routeConversation(
  provider: ProviderConfig,
  message: string,
  context: { hasActiveTask?: boolean; latestTaskStatus?: TaskRecord['status'] } = {},
): Promise<ConversationDecision> {
  const ruleDecision = routeConversationByRules(message, context)
  if (ruleDecision) return ruleDecision

  if (process.env.DEMO_SKIP_CONVERSATION_ROUTER === '1') {
    return {
      action: 'clarify',
      confidence: 0.6,
      source: 'fallback',
      message: `I can discuss the request first. To start execution, explicitly ask me to run one of: ${supportedWorkflowText()}.`,
      reason: 'conversation router skipped',
    }
  }

  try {
    const response = await fetch(`${llmEngineUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        temperature: 0,
        maxTokens: 220,
        timeoutSeconds: 45,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: [
              'Classify the user message for a public bioinformatics demo.',
              'Return one compact JSON object only.',
              'Allowed actions: answer, clarify, status, run_analysis.',
              'Use run_analysis only when the user clearly asks to run, execute, analyze, process, start, or plan a workflow now.',
              'If the user only mentions a data type, asks a question, greets, or gives vague context, use answer or clarify.',
              'Allowed workflowKey values: bulk_rna_seq, single_cell_rna_seq, proteomics_lfq.',
              '{"action":"answer|clarify|status|run_analysis","message":"...","confidence":0.0,"workflowKey":"...","analysisPrompt":"...","reason":"..."}',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `Active task: ${context.hasActiveTask ? 'yes' : 'no'}`,
              `Latest task status: ${context.latestTaskStatus || 'none'}`,
              `Message: ${message}`,
            ].join('\n'),
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`Conversation router HTTP ${response.status}`)
    }

    const payload = await response.json() as { content?: string }
    const decision = normalizeDecision(parseDecision(payload.content || ''), message)
    if (decision.action === 'run_analysis' && context.hasActiveTask) {
      return {
        action: 'status',
        confidence: 0.88,
        source: 'fast_rule',
        message: 'A task is already running. Wait for it to finish before starting another workflow.',
        reason: 'active task prevents new execution',
      }
    }
    if (decision.action === 'run_analysis' && !decision.workflowKey) {
      return {
        action: 'clarify',
        confidence: 0.82,
        source: 'fast_rule',
        message: `Which public workflow should I use: ${supportedWorkflowText()}?`,
        reason: 'model requested execution without workflow',
      }
    }
    return decision
  } catch (error) {
    return {
      action: 'clarify',
      confidence: 0.5,
      source: 'fallback',
      message: `I can discuss the request first. To start execution, explicitly ask me to run one of: ${supportedWorkflowText()}.`,
      reason: error instanceof Error ? error.message : 'conversation router failed',
    }
  }
}
