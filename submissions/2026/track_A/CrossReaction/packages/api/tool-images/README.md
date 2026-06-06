# Demo Tool Images

This directory only contains local build contexts for wrapper images used by the review demo.

Current local build contexts:

- `pydeseq2-rnaseq/`: wraps the public `quay.io/biocontainers/pydeseq2:0.5.4--pyhdfd78af_0` image with the demo runner script.

Public images that are pulled directly at runtime:

- `quay.io/biocontainers/fastqc:0.12.1--hdfd78af_0`
- `quay.io/biocontainers/trimmomatic:0.39--hdfd78af_2`
- `quay.io/biocontainers/fastp:0.23.4--hadf994f_2`
- `quay.io/biocontainers/kallisto:0.51.1--h2b92561_2`
- `quay.io/biocontainers/multiqc:1.21--pyhdfd78af_0`
- `ghcr.io/getwilds/scanpy:latest`
- `quay.io/biocontainers/bioconductor-limma:3.58.1--r43ha9d7317_1`
- `quay.io/biocontainers/openms:3.4.1--heb594b5_0`
- `quay.io/biocontainers/bioconductor-msstats:4.10.0--r43hf17093f_1`

Run `bash scripts/prepare-tool-images.sh` to prefetch the public images and build the local wrapper images used by the demo.
