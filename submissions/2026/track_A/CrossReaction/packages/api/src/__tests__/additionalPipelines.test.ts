import { afterEach, describe, expect, it } from 'vitest'
import { runProteomicsDemo } from '../proteomicsPipeline.js'
import { runSingleCellDemo } from '../singleCellPipeline.js'
import { demoToolImages } from '../toolImages.js'
import type { ModelPlan, ProviderConfig, TimelineEventInput } from '../types.js'

const provider: ProviderConfig = {
  provider: 'local_openai_compatible',
  baseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: 'local-placeholder-token',
  model: 'gemma4:latest',
}

function modelPlan(workflowKey: 'single_cell_rna_seq' | 'proteomics_lfq'): ModelPlan {
  return {
    intent: workflowKey === 'single_cell_rna_seq'
      ? 'Identify clusters, marker genes, and treatment-associated cell-state changes.'
      : 'Analyze label-free proteomics differential abundance.',
    comparison: 'treatment vs control',
    model: 'gemma4:latest',
    rawResponse: '',
    source: 'model',
    workflowKey,
    steps: [
      {
        id: workflowKey,
        title: 'Run public tool workflow',
        description: 'Execute a transparent public container workflow.',
      },
    ],
  }
}

describe('additional executable demo pipelines', () => {
  afterEach(() => {
    delete process.env.DEMO_SKIP_MODEL_SUMMARY
  })

  it('runs the single-cell toy dataset with Scanpy in Docker', async () => {
    process.env.DEMO_SKIP_MODEL_SUMMARY = '1'
    const events: TimelineEventInput[] = []
    const result = await runSingleCellDemo('test-single-cell', provider, modelPlan('single_cell_rna_seq'), (event) => events.push(event))

    expect(result.workflowKey).toBe('single_cell_rna_seq')
    expect(result.toolRuns.map((run) => run.image)).toEqual([
      demoToolImages.fastqc.image,
      demoToolImages.fastp.image,
      demoToolImages.scanpy.image,
      demoToolImages.limma.image,
    ])
    expect(result.tables.find((table) => table.title === 'Cell clusters')?.rows.length).toBeGreaterThan(0)
    expect(result.tables.find((table) => table.title === 'Marker genes')?.rows.length).toBeGreaterThan(0)
    expect(events.map((event) => `${event.id}:${event.status}`)).toContain('execution-04-limma:completed')
  }, 180000)

  it('runs the proteomics toy dataset with limma in Docker', async () => {
    process.env.DEMO_SKIP_MODEL_SUMMARY = '1'
    const events: TimelineEventInput[] = []
    const result = await runProteomicsDemo('test-proteomics', provider, modelPlan('proteomics_lfq'), (event) => events.push(event))

    expect(result.workflowKey).toBe('proteomics_lfq')
    expect(result.toolRuns.map((run) => run.image)).toEqual([
      demoToolImages.openms.image,
      demoToolImages.limma.image,
      demoToolImages.msstats.image,
    ])
    expect(result.tables.find((table) => table.title === 'limma differential abundance')?.rows.length).toBeGreaterThan(0)
    expect(events.map((event) => `${event.id}:${event.status}`)).toContain('execution-03-msstats:completed')
  }, 180000)
})
