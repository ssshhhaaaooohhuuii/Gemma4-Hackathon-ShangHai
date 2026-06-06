import type { PlannedStep, SampleDataInfo, WorkflowExecutionMode } from './types.js'
import { demoToolImages } from './toolImages.js'

export type WorkflowKey = 'bulk_rna_seq' | 'single_cell_rna_seq' | 'proteomics_lfq'

export type WorkflowContract = {
  key: WorkflowKey
  name: string
  description: string
  executionMode: WorkflowExecutionMode
  executionNote: string
  sampleData: SampleDataInfo
  steps: PlannedStep[]
}

export const workflowCatalog: WorkflowContract[] = [
  {
    key: 'bulk_rna_seq',
    name: 'Bulk RNA-seq treatment vs control',
    description: 'Single-end toy bulk RNA-seq workflow with real Docker execution in this review build.',
    executionMode: 'executable',
    executionNote: 'This workflow can be executed end to end with the included public toy dataset.',
    sampleData: {
      status: 'included',
      label: 'Included public toy bulk RNA-seq data',
      description: 'Four single-end FASTQ files, treatment/control metadata, and a tiny transcript reference are included for real Docker execution.',
      files: [
        'demo-data/bulk_rnaseq/metadata.csv',
        'demo-data/bulk_rnaseq/reference_transcripts.fa',
        'demo-data/bulk_rnaseq/samples/control_1.fastq',
        'demo-data/bulk_rnaseq/samples/control_2.fastq',
        'demo-data/bulk_rnaseq/samples/treatment_1.fastq',
        'demo-data/bulk_rnaseq/samples/treatment_2.fastq',
      ],
    },
    steps: [
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
        title: 'Compare treatment vs control',
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
        title: 'Generate model interpretation',
        description: 'Ask the configured Gemma 4 endpoint to interpret the transparent result.',
        toolName: 'Gemma 4 via OpenAI-compatible API',
        toolImage: 'local model endpoint',
      },
    ],
  },
  {
    key: 'single_cell_rna_seq',
    name: 'Single-cell RNA-seq expression analysis',
    description: 'Executable 10x-style single-cell RNA-seq workflow using public Scanpy tooling.',
    executionMode: 'executable',
    executionNote: 'This workflow can be executed end to end with included single-cell toy data and a public Scanpy container.',
    sampleData: {
      status: 'included',
      label: 'Included single-cell RNA-seq toy data',
      description: 'A tiny synthetic gene-by-cell matrix, cell metadata, and marker reference are included for real Scanpy container execution.',
      files: [
        'demo-data/single_cell_rnaseq/metadata/cell_metadata.csv',
        'demo-data/single_cell_rnaseq/fastq/control_cells.fastq',
        'demo-data/single_cell_rnaseq/fastq/treatment_cells.fastq',
        'demo-data/single_cell_rnaseq/matrix/gene_counts.csv',
        'demo-data/single_cell_rnaseq/reference/gene_markers.csv',
        'demo-data/single_cell_rnaseq/README.md',
      ],
    },
    steps: [
      {
        id: 'fastqc',
        title: 'Inspect single-cell FASTQ quality',
        description: 'Run FastQC on the included tiny single-cell FASTQ files before matrix-level analysis.',
        toolName: 'FastQC',
        toolImage: demoToolImages.fastqc.image,
      },
      {
        id: 'fastp',
        title: 'Preprocess single-cell reads',
        description: 'Run fastp to produce trimmed FASTQ files and JSON/HTML read-quality reports.',
        toolName: 'fastp',
        toolImage: demoToolImages.fastp.image,
      },
      {
        id: 'scanpy_qc',
        title: 'Compute cell-level QC metrics',
        description: 'Compute total counts and detected genes for each cell before normalization.',
        toolName: 'Scanpy',
        toolImage: demoToolImages.scanpy.image,
      },
      {
        id: 'scanpy_cluster',
        title: 'Normalize and cluster cells',
        description: 'Normalize counts, log-transform, reduce dimensionality, build a neighborhood graph, and cluster cells.',
        toolName: 'Scanpy',
        toolImage: demoToolImages.scanpy.image,
      },
      {
        id: 'marker_genes',
        title: 'Find marker genes',
        description: 'Identify cluster marker genes and summarize cell-state signals.',
        toolName: 'Scanpy',
        toolImage: demoToolImages.scanpy.image,
      },
      {
        id: 'limma_state',
        title: 'Compare marker-level cell-state changes',
        description: 'Run limma on marker gene counts to summarize treatment-associated cell-state changes.',
        toolName: 'limma',
        toolImage: demoToolImages.limma.image,
      },
      {
        id: 'summary',
        title: 'Generate model interpretation',
        description: 'Ask the configured Gemma 4 endpoint to summarize the single-cell analysis plan and expected outputs.',
        toolName: 'Gemma 4 via OpenAI-compatible API',
        toolImage: 'local model endpoint',
      },
    ],
  },
  {
    key: 'proteomics_lfq',
    name: 'Label-free proteomics differential abundance',
    description: 'Executable label-free proteomics differential abundance workflow using public limma tooling.',
    executionMode: 'executable',
    executionNote: 'This workflow can be executed end to end with included proteomics toy data and a public Bioconductor limma container.',
    sampleData: {
      status: 'included',
      label: 'Included label-free proteomics toy data',
      description: 'A tiny synthetic protein intensity matrix, sample metadata, protein FASTA, and mzML-like files are included for real limma container execution.',
      files: [
        'demo-data/proteomics_lfq/metadata/sample_metadata.csv',
        'demo-data/proteomics_lfq/quant/protein_intensity.csv',
        'demo-data/proteomics_lfq/database/proteins.fasta',
        'demo-data/proteomics_lfq/spectra/control_1.mzML',
        'demo-data/proteomics_lfq/spectra/treatment_1.mzML',
        'demo-data/proteomics_lfq/README.md',
      ],
    },
    steps: [
      {
        id: 'raw_convert',
        title: 'Validate proteomics inputs',
        description: 'Check sample metadata, protein FASTA context, mzML-like files, and the quantified LFQ protein-intensity matrix.',
        toolName: 'OpenMS',
        toolImage: demoToolImages.openms.image,
      },
      {
        id: 'openms_qc',
        title: 'Inspect mzML file quality',
        description: 'Run OpenMS FileInfo on included mzML-like inputs and record file-level QC artifacts.',
        toolName: 'OpenMS',
        toolImage: demoToolImages.openms.image,
      },
      {
        id: 'openms_identification',
        title: 'Load quantified protein abundance',
        description: 'Use the included protein-level intensity matrix as the quantified protein input.',
        toolName: 'limma',
        toolImage: demoToolImages.limma.image,
      },
      {
        id: 'openms_quant',
        title: 'Model protein abundance',
        description: 'Normalize and model protein-level log intensity values across conditions.',
        toolName: 'limma',
        toolImage: demoToolImages.limma.image,
      },
      {
        id: 'msstats',
        title: 'Check MSstats compatibility',
        description: 'Run MSstats in Docker to verify package availability and LFQ table shape for downstream statistical workflows.',
        toolName: 'MSstats',
        toolImage: demoToolImages.msstats.image,
      },
      {
        id: 'summary',
        title: 'Generate model interpretation',
        description: 'Ask the configured Gemma 4 endpoint to summarize differential abundance findings and caveats.',
        toolName: 'Gemma 4 via OpenAI-compatible API',
        toolImage: 'local model endpoint',
      },
    ],
  },
]

export function defaultWorkflow(): WorkflowContract {
  return workflowCatalog[0]
}

export function findWorkflow(key: unknown): WorkflowContract {
  const normalized = String(key || '').trim()
  const workflow = workflowCatalog.find((item) => item.key === normalized)
  if (!workflow) {
    throw new Error(`Model selected an unknown workflowKey: ${normalized || 'empty'}`)
  }
  return workflow
}

export function workflowCatalogPrompt(): string {
  return workflowCatalog
    .map((workflow) => [
      `workflowKey=${workflow.key}`,
      `name=${workflow.name}`,
      `executionMode=${workflow.executionMode}`,
      `description=${workflow.description}`,
      `sampleData=${workflow.sampleData.label}: ${workflow.sampleData.description}`,
      `stepIds=${workflow.steps.map((step) => step.id).join(', ')}`,
      `tools=${workflow.steps.map((step) => `${step.id}:${step.toolName}`).join('; ')}`,
    ].join('\n'))
    .join('\n\n')
}
