import { demoToolImages } from './toolImages.js'
import { findWorkflow, workflowCatalog, type WorkflowContract } from './workflowCatalog.js'
import { publicToolNames, type PublicToolName } from './publicToolManifest.js'

const privateProjectSegment = 'cross_reaction_' + 'client'
const privatePathPattern = new RegExp(`/Users/[^/\\s]+/Workspaces/Services/cross_reaction/${privateProjectSegment}[^\\s]*`, 'g')
const secretPattern = /(api[_-]?key|token|secret|password)\s*[:=]\s*[^,\s]+/gi

export function sanitizePublicText(value: unknown): string {
  // 中文：公开审计输出统一经过脱敏，避免本地路径、token 或私有项目标识进入评审包和 UI。
  // EN: Public audit output is sanitized so local paths, tokens, or private project identifiers do not reach the review package or UI.
  return String(value ?? '')
    .replace(privatePathPattern, '[private-project-path]')
    .replace(secretPattern, '$1=[redacted]')
    .slice(0, 1200)
}

export function assertPublicToolName(name: string): asserts name is PublicToolName {
  // 中文：工具名白名单是 Agent tool calling 的安全边界，模型不能请求未公开的工具。
  // EN: The tool-name whitelist is the safety boundary for agent tool calling; the model cannot request unpublished tools.
  if (!publicToolNames().includes(name as PublicToolName)) {
    throw new Error(`Unsupported public review tool: ${name}`)
  }
}

export function publicWorkflowOrThrow(workflowKey: unknown): WorkflowContract {
  return findWorkflow(String(workflowKey || '').trim())
}

export function assertPublicSampleFiles(workflowKey: unknown, files: unknown[]) {
  const workflow = publicWorkflowOrThrow(workflowKey)
  const allowed = new Set(workflow.sampleData.files)
  for (const file of files) {
    if (!allowed.has(String(file))) {
      throw new Error(`Unsupported public sample file: ${file}`)
    }
  }
}

export function assertPublicToolImage(image: string) {
  const publicImages = new Set([
    ...Object.values(demoToolImages).map((definition) => definition.image),
    'local model endpoint',
  ])
  if (!publicImages.has(image)) {
    throw new Error(`Unsupported public tool image: ${image}`)
  }
}

export function workflowSummaryForPublicTrace() {
  return workflowCatalog.map((workflow) => ({
    key: workflow.key,
    name: workflow.name,
    description: workflow.description,
    executionMode: workflow.executionMode,
    tools: workflow.steps.map((step) => ({
      id: step.id,
      name: step.toolName || step.title,
      image: step.toolImage || 'not specified',
    })),
  }))
}
