import { describe, expect, it, vi } from 'vitest'
import { publicToolDefinitions, publicToolNames } from '../publicToolManifest.js'
import { assertPublicSampleFiles, assertPublicToolName, publicWorkflowOrThrow, sanitizePublicText } from '../reviewAgentGuards.js'
import { persistReviewAgentArtifacts, requestReviewAgentPlan, type ReviewAgentModelCaller } from '../reviewAgentRuntime.js'
import { routeConversationByRules } from '../conversationRouter.js'
import { requestModelChatWithTools } from '../llmClient.js'
import type { ProviderConfig } from '../types.js'

const provider: ProviderConfig = {
  provider: 'local_openai_compatible',
  baseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: 'local-placeholder-token',
  model: 'gemma4:latest',
}

describe('public review agent manifest and guards', () => {
  it('exposes the required public tool names', () => {
    expect(publicToolNames()).toEqual([
      'inspect_available_workflows',
      'inspect_sample_data',
      'select_workflow',
      'draft_execution_plan',
      'summarize_results',
    ])
  })

  it('defines strict object schemas for all public tools', () => {
    expect(publicToolDefinitions.every((definition) => definition.type === 'function')).toBe(true)
    expect(publicToolDefinitions.every((definition) => definition.function.parameters.additionalProperties === false)).toBe(true)
  })

  it('accepts only public workflow keys', () => {
    expect(publicWorkflowOrThrow('bulk_rna_seq').name).toContain('Bulk RNA-seq')
    expect(() => publicWorkflowOrThrow('private_workflow')).toThrow(/unknown workflowKey/)
  })

  it('accepts only public sample files from the selected workflow', () => {
    expect(() => assertPublicSampleFiles('bulk_rna_seq', ['demo-data/bulk_rnaseq/metadata.csv'])).not.toThrow()
    expect(() => assertPublicSampleFiles('bulk_rna_seq', ['private/customer.fastq'])).toThrow(/Unsupported public sample file/)
  })

  it('accepts only public review tool names', () => {
    expect(() => assertPublicToolName('select_workflow')).not.toThrow()
    expect(() => assertPublicToolName('unsupported_scheduler')).toThrow(/Unsupported public review tool/)
  })

  it('redacts private paths and secret-like values from trace text', () => {
    const privatePath = `/Users/example/Workspaces/Services/cross_reaction/${'cross_reaction_' + 'client'}/apps ${'api_key=' + 'abc123'}`
    const cleaned = sanitizePublicText(privatePath)
    expect(cleaned).toContain('[private-project-path]')
    expect(cleaned).toContain('api_key=[redacted]')
    expect(cleaned).not.toContain('abc123')
  })

  it('builds a model plan from guided native public tool calls', async () => {
    const modelCaller = vi.fn<ReviewAgentModelCaller>(async (_provider, _messages, _tools, toolChoice) => {
      const forcedName = typeof toolChoice === 'object' ? toolChoice.function?.name : undefined
      if (forcedName === 'select_workflow') {
        return {
          content: '',
          toolCalls: [
            {
              id: 'call-select',
              function: {
                name: 'select_workflow',
                arguments: JSON.stringify({
                  workflowKey: 'bulk_rna_seq',
                  reason: 'FASTQ treatment vs control request.',
                  comparison: 'treatment vs control',
                }),
              },
            },
          ],
        }
      }
      return { content: '', toolCalls: [], error: 'unexpected tool choice' }
    })

    const plan = await requestReviewAgentPlan(provider, 'Run a bulk RNA-seq treatment vs control analysis.', modelCaller)
    expect(plan.workflowKey).toBe('bulk_rna_seq')
    expect(plan.model).toBe('gemma4:latest')
    expect(plan.agentRun?.mode).toBe('native_guided_tool_calling')
    expect(plan.agentRun?.model).toBe('gemma4:latest')
    expect(plan.agentRun?.toolCalls.map((toolCall) => toolCall.name)).toEqual([
      'select_workflow',
      'inspect_sample_data',
      'draft_execution_plan',
    ])
    expect(plan.agentRun?.toolCalls.map((toolCall) => toolCall.origin)).toEqual([
      'model_native',
      'system_grounding',
      'system_grounding',
    ])
    expect(plan.agentRun?.memory.toolCallIds).toEqual([
      'call-select',
      'system-inspect-sample-data',
      'system-draft-execution-plan',
    ])
    expect(modelCaller).toHaveBeenCalledTimes(1)
    expect(plan.agentRun?.memory.observedToyData).toContain('demo-data/bulk_rnaseq/metadata.csv')
  })

  it('disables reasoning for OpenAI-compatible native tool calls', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'))
      expect(body.reasoningEffort).toBe('none')
      expect(body.toolChoice).toBe('auto')
      expect(body.timeoutSeconds).toBe(45)
      expect(body.maxTokens).toBe(256)
      expect(body.tools).toHaveLength(1)
      return new Response(JSON.stringify({
        content: '',
        tool_calls: [
          {
            id: 'call-weather',
            type: 'function',
            function: {
              name: 'get_current_weather',
              arguments: '{"location":"Seoul"}',
            },
          },
        ],
      }), { status: 200 })
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch
    try {
      const response = await requestModelChatWithTools(provider, [
        { role: 'user', content: 'Use the weather tool for Seoul.' },
      ], [
        {
          type: 'function',
          function: {
            name: 'get_current_weather',
            parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] },
          },
        },
      ])
      expect(response.toolCalls).toHaveLength(1)
      expect(response.toolCalls[0].function?.name).toBe('get_current_weather')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('captures guided tool-schema planning when native tool calls are absent', async () => {
    const modelCaller = vi.fn<ReviewAgentModelCaller>(async (_provider, _messages, _tools, toolChoice) => {
      const forcedName = typeof toolChoice === 'object' ? toolChoice.function?.name : undefined
      if (forcedName === 'select_workflow') {
        return {
          content: JSON.stringify({
            workflowKey: 'bulk_rna_seq',
            reason: 'Bulk RNA-seq treatment vs control request.',
            comparison: 'treatment vs control',
          }),
          toolCalls: [],
        }
      }
      return { content: '', toolCalls: [], error: 'unexpected tool choice' }
    })

    const plan = await requestReviewAgentPlan(provider, 'Run a bulk RNA-seq treatment vs control analysis.', modelCaller)
    expect(plan.workflowKey).toBe('bulk_rna_seq')
    expect(plan.agentRun?.mode).toBe('guided_tool_calling')
    expect(plan.agentRun?.toolCalls.map((toolCall) => toolCall.name)).toEqual([
      'select_workflow',
      'inspect_sample_data',
      'draft_execution_plan',
    ])
    expect(plan.agentRun?.toolCalls[0].origin).toBe('model_schema')
    expect(plan.agentRun?.toolCalls.slice(1).map((toolCall) => toolCall.origin)).toEqual([
      'system_grounding',
      'system_grounding',
    ])
  })

  it('accepts object-shaped tool arguments from Gemma-compatible parsers', async () => {
    const modelCaller = vi.fn<ReviewAgentModelCaller>(async () => ({
      content: '',
      toolCalls: [
        {
          id: 'call-select-object-args',
          function: {
            name: 'select_workflow',
            arguments: {
              workflowKey: 'bulk_rna_seq',
              reason: 'Object-shaped Gemma parser arguments.',
              comparison: 'treatment vs control',
            },
          },
        },
      ],
    }))

    const plan = await requestReviewAgentPlan(provider, 'Run a bulk RNA-seq treatment vs control analysis.', modelCaller)
    expect(plan.agentRun?.mode).toBe('native_guided_tool_calling')
    expect(plan.agentRun?.toolCalls[0].arguments.workflowKey).toBe('bulk_rna_seq')
    expect(plan.agentRun?.toolCalls[0].origin).toBe('model_native')
  })

  it('falls back when native tool calls are unavailable', async () => {
    process.env.DEMO_SKIP_MODEL_PLANNING = '1'
    const modelCaller: ReviewAgentModelCaller = async () => ({
      content: '',
      toolCalls: [],
      error: 'tool calling unavailable',
    })

    const plan = await requestReviewAgentPlan(provider, 'Run a bulk RNA-seq treatment vs control analysis.', modelCaller)
    delete process.env.DEMO_SKIP_MODEL_PLANNING

    expect(plan.agentRun?.mode).toBe('json_fallback')
    expect(plan.workflowKey).toBe('bulk_rna_seq')
    expect(plan.agentRun?.toolCalls).toEqual([
      expect.objectContaining({
        id: 'json-fallback-plan',
        name: 'json_fallback_plan',
        origin: 'json_fallback',
        status: 'completed',
      }),
    ])
    expect(plan.agentRun?.memory.toolCallIds).toEqual(['json-fallback-plan'])
  })

  it('persists public review agent artifacts', async () => {
    process.env.DEMO_SKIP_MODEL_PLANNING = '1'
    const plan = await requestReviewAgentPlan(provider, 'Run a bulk RNA-seq treatment vs control analysis.', async () => ({
      content: '',
      toolCalls: [],
      error: 'force fallback',
    }))
    delete process.env.DEMO_SKIP_MODEL_PLANNING
    const persisted = await persistReviewAgentArtifacts('test-review-agent-artifacts', plan.agentRun)
    expect(persisted?.artifactPaths?.memory).toContain('agent-memory.json')
    expect(persisted?.artifactPaths?.toolCalls).toContain('tool-calls.json')
    expect(persisted?.artifactPaths?.trace).toContain('agent-trace.json')
  })
})

describe('conversation intent routing', () => {
  it('does not start analysis when the user only mentions a workflow area', () => {
    const decision = routeConversationByRules('bulk RNA-seq', {})
    expect(decision?.action).toBe('clarify')
    expect(decision?.workflowKey).toBe('bulk_rna_seq')
  })

  it('starts analysis only for explicit execution intent', () => {
    const decision = routeConversationByRules('Please run bulk RNA-seq treatment vs control analysis now.', {})
    expect(decision?.action).toBe('run_analysis')
    expect(decision?.workflowKey).toBe('bulk_rna_seq')
    expect(decision?.analysisPrompt).toContain('bulk RNA-seq')
  })

  it('answers workflow questions without execution', () => {
    const decision = routeConversationByRules('Can you explain single-cell RNA-seq first?', {})
    expect(decision?.action).toBe('answer')
    expect(decision?.workflowKey).toBe('single_cell_rna_seq')
  })

  it('reports status instead of starting another active task', () => {
    const decision = routeConversationByRules('run proteomics analysis', {
      hasActiveTask: true,
      latestTaskStatus: 'running',
    })
    expect(decision?.action).toBe('status')
    expect(decision?.message).toMatch(/already running/i)
  })
})
