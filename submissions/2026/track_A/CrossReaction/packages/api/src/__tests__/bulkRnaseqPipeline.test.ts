import { afterEach, describe, expect, it } from 'vitest'
import { runBulkRnaseqDemo, testOnly } from '../bulkRnaseqPipeline.js'
import { demoToolImages } from '../toolImages.js'
import type { TimelineEventInput } from '../types.js'

describe('bulk RNA-seq demo pipeline helpers', () => {
  afterEach(() => {
    delete process.env.DEMO_SKIP_MODEL_SUMMARY
  })

  it('parses FASTQ records', () => {
    const reads = testOnly.parseFastq('@r1\nAACCGG\n+\nIIIIII\n@r2\nTTGGAA\n+\nIIIIII\n')
    expect(reads).toEqual(['AACCGG', 'TTGGAA'])
  })

  it('rejects FASTQ records with mismatched sequence and quality lengths', () => {
    expect(() => testOnly.parseFastq('@r1\nAACCGG\n+\nIIII\n')).toThrow(/quality lengths differ/)
  })

  it('computes differential direction from count matrix', () => {
    const result = testOnly.differential(
      {
        GeneA: { control_1: 1, control_2: 1, treatment_1: 5, treatment_2: 6 },
        GeneB: { control_1: 3, control_2: 4, treatment_1: 3, treatment_2: 4 },
      },
      [
        { sampleId: 'control_1', condition: 'control', fastq: 'a.fastq' },
        { sampleId: 'control_2', condition: 'control', fastq: 'b.fastq' },
        { sampleId: 'treatment_1', condition: 'treatment', fastq: 'c.fastq' },
        { sampleId: 'treatment_2', condition: 'treatment', fastq: 'd.fastq' },
      ],
    )

    expect(result.find((gene) => gene.gene === 'GeneA')?.direction).toBe('up')
    expect(result.find((gene) => gene.gene === 'GeneB')?.direction).toBe('stable')
  })

  it('runs the public toy dataset end to end with Docker tool steps', async () => {
    process.env.DEMO_SKIP_MODEL_SUMMARY = '1'
    const events: TimelineEventInput[] = []
    const result = await runBulkRnaseqDemo(
      'test-job',
      'Run the public toy bulk RNA-seq comparison.',
      {
        provider: 'local_openai_compatible',
        baseUrl: 'http://127.0.0.1:11434/v1',
        apiKey: 'local-placeholder-token',
        model: 'gemma4:latest',
      },
      {
        intent: 'Run a transparent toy bulk RNA-seq treatment vs control analysis.',
        comparison: 'treatment vs control',
        model: 'gemma4:latest',
        rawResponse: '',
        source: 'fallback',
        sourceMessage: 'Test workflow template.',
        steps: [
          {
            id: 'fastqc',
            title: 'Run raw read quality control',
            description: 'Inspect FASTQ quality metrics.',
            toolName: 'FastQC',
            toolImage: demoToolImages.fastqc.image,
          },
        ],
      },
      (event) => events.push(event),
    )

    expect(result.modelPlan.model).toBe('gemma4:latest')
    expect(result.toolRuns.map((run) => run.image)).toEqual([
      demoToolImages.fastqc.image,
      demoToolImages.trimmomatic.image,
      demoToolImages.kallisto.image,
      demoToolImages.pydeseq2.image,
      demoToolImages.multiqc.image,
    ])
    expect(result.qc).toHaveLength(4)
    expect(result.differential.find((gene) => gene.gene === 'GeneA_interferon_marker')?.direction).toBe('up')
    expect(result.differential.find((gene) => gene.gene === 'GeneB_housekeeping_marker')?.direction).toBe('stable')
    expect(result.differential.find((gene) => gene.gene === 'GeneC_metabolic_marker')?.direction).toBe('down')
    expect(result.reportMarkdown).toContain('Bulk RNA-seq Toy Analysis Report')
    expect(events.map((event) => `${event.id}:${event.status}`)).toEqual([
      'execution-01-fastqc:running',
      'execution-01-fastqc:completed',
      'execution-02-trimmomatic:running',
      'execution-02-trimmomatic:completed',
      'execution-03-kallisto:running',
      'execution-03-kallisto:completed',
      'execution-04-pydeseq2:running',
      'execution-04-pydeseq2:completed',
      'execution-05-multiqc:running',
      'execution-05-multiqc:completed',
      'model-interpretation:running',
      'model-interpretation:completed',
    ])
  }, 180000)
})
