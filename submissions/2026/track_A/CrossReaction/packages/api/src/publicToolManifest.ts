import { workflowCatalog } from './workflowCatalog.js'

export type PublicToolName =
  | 'inspect_available_workflows'
  | 'inspect_sample_data'
  | 'select_workflow'
  | 'draft_execution_plan'
  | 'summarize_results'

export type PublicToolDefinition = {
  type: 'function'
  function: {
    name: PublicToolName
    description: string
    parameters: Record<string, unknown>
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

const workflowEnum = workflowCatalog.map((workflow) => workflow.key)

// 中文：这些是暴露给 Gemma 4 的公开函数调用契约，评审可从这里确认 Agent 只能选择公开 workflow、样例数据和工具容器。
// EN: These are the public function-calling contracts exposed to Gemma 4, so reviewers can verify the agent is limited to public workflows, sample data, and tool containers.
export const publicToolDefinitions: PublicToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'inspect_available_workflows',
      description: 'List public review workflows and public tool containers available in this demo.',
      parameters: objectSchema({}),
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_sample_data',
      description: 'Inspect public toy sample data for one selected workflow.',
      parameters: objectSchema({
        workflowKey: {
          type: 'string',
          enum: workflowEnum,
          description: 'Public workflow key to inspect.',
        },
      }, ['workflowKey']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'select_workflow',
      description: 'Select one public workflow for the user request and explain the public review reason.',
      parameters: objectSchema({
        workflowKey: {
          type: 'string',
          enum: workflowEnum,
        },
        reason: {
          type: 'string',
          description: 'Short public reason for selecting this workflow.',
        },
        comparison: {
          type: 'string',
          description: 'Comparison extracted from the request, such as treatment vs control.',
        },
      }, ['workflowKey', 'reason', 'comparison']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_execution_plan',
      description: 'Draft visible execution plan steps using only the selected public workflow contract.',
      parameters: objectSchema({
        workflowKey: {
          type: 'string',
          enum: workflowEnum,
        },
        intent: {
          type: 'string',
          description: 'Short analysis intent extracted from the request.',
        },
        comparison: {
          type: 'string',
          description: 'Condition comparison for the public toy workflow.',
        },
        requestedOutputs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Requested public outputs such as QC, count matrix, differential summary, or report.',
        },
      }, ['workflowKey', 'intent', 'comparison']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_results',
      description: 'Summarize public computed result tables in one concise sentence with one caveat.',
      parameters: objectSchema({
        workflowKey: {
          type: 'string',
          enum: workflowEnum,
        },
        compactResult: {
          type: 'string',
          description: 'Compact public result table summary.',
        },
      }, ['workflowKey', 'compactResult']),
    },
  },
]

export function publicToolNames() {
  return publicToolDefinitions.map((definition) => definition.function.name)
}
