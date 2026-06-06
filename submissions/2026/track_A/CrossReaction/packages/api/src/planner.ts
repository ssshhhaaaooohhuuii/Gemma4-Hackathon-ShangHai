import type { PlannedStep } from './types.js'
import { demoToolImages } from './toolImages.js'

export function buildBulkRnaseqPlan(prompt: string): PlannedStep[] {
  const trimmedPrompt = prompt.trim()
  const comparison = trimmedPrompt.toLowerCase().includes('treatment')
    ? 'treatment vs control'
    : 'condition comparison'

  return [
    {
      id: 'fastqc',
      title: 'Run raw read quality control',
      description: 'Use FastQC to inspect each uploaded FASTQ sample before preprocessing.',
      toolName: 'FastQC',
      toolImage: demoToolImages.fastqc.image,
    },
    {
      id: 'trimmomatic',
      title: 'Preprocess single-end reads',
      description: 'Use Trimmomatic to apply a minimal single-end read filtering step.',
      toolName: 'Trimmomatic',
      toolImage: demoToolImages.trimmomatic.image,
    },
    {
      id: 'kallisto',
      title: 'Quantify transcripts',
      description: 'Build a kallisto transcriptome index and quantify each sample against the toy transcriptome.',
      toolName: 'kallisto',
      toolImage: demoToolImages.kallisto.image,
    },
    {
      id: 'pydeseq2',
      title: `Compare ${comparison}`,
      description: 'Use PyDESeq2 to run a differential expression step from the kallisto-derived count matrix.',
      toolName: 'PyDESeq2',
      toolImage: demoToolImages.pydeseq2.image,
    },
    {
      id: 'multiqc',
      title: 'Aggregate tool reports',
      description: 'Use MultiQC to collect FastQC, Trimmomatic, kallisto, and downstream outputs into one review report.',
      toolName: 'MultiQC',
      toolImage: demoToolImages.multiqc.image,
    },
    {
      id: 'summary',
      title: 'Generate reviewer-facing summary',
      description: 'Create a compact report and ask the configured Gemma 4 endpoint for interpretation when available.',
      toolName: 'Gemma 4 via OpenAI-compatible API',
      toolImage: 'local model endpoint',
    },
  ]
}
