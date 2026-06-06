# Single-cell RNA-seq Toy Data

This directory contains a tiny public-style toy matrix for real Scanpy container execution in the review demo.

- `metadata/cell_metadata.csv`: six cells across treatment and control samples.
- `fastq/*.fastq`: tiny FASTQ files used to run FastQC and fastp as visible upstream QC/preprocessing steps.
- `matrix/gene_counts.csv`: gene-by-cell count matrix with marker genes.
- `reference/gene_markers.csv`: marker annotations used for interpretation.

The data are synthetic and intentionally small. They exercise the analysis path but are not intended for statistical claims.
