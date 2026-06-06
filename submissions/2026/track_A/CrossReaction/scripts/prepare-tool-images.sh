#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLEAN_DOCKER_CONFIG=".review-data/docker-config"

pull_public_image() {
  local image="$1"
  local pull_log
  pull_log="$(mktemp)"

  if docker pull "$image" >"$pull_log" 2>&1; then
    cat "$pull_log"
    rm -f "$pull_log"
    return 0
  fi

  if rg -i "credentials?|credsStore|credential helper|parameters passed to the function" "$pull_log" >/dev/null 2>&1; then
    echo "Docker credential helper failed for $image. Retrying with clean local Docker config."
    mkdir -p "$CLEAN_DOCKER_CONFIG"
    printf '{"auths":{}}\n' >"$CLEAN_DOCKER_CONFIG/config.json"
    if DOCKER_CONFIG="$ROOT_DIR/$CLEAN_DOCKER_CONFIG" docker pull "$image"; then
      rm -f "$pull_log"
      return 0
    fi
  fi

  cat "$pull_log" >&2
  rm -f "$pull_log"
  return 1
}

public_images=(
  "quay.io/biocontainers/fastqc:0.12.1--hdfd78af_0"
  "quay.io/biocontainers/trimmomatic:0.39--hdfd78af_2"
  "quay.io/biocontainers/fastp:0.23.4--hadf994f_2"
  "quay.io/biocontainers/kallisto:0.51.1--h2b92561_2"
  "quay.io/biocontainers/multiqc:1.21--pyhdfd78af_0"
  "ghcr.io/getwilds/scanpy:latest"
  "quay.io/biocontainers/bioconductor-limma:3.58.1--r43ha9d7317_1"
  "quay.io/biocontainers/openms:3.4.1--heb594b5_0"
  "quay.io/biocontainers/bioconductor-msstats:4.10.0--r43hf17093f_1"
)

for image in "${public_images[@]}"; do
  if docker image inspect "$image" >/dev/null 2>&1; then
    echo "Already present: $image"
    continue
  fi
  echo "Pulling: $image"
  pull_public_image "$image"
done

local_builds=(
  "gemma-demo/pydeseq2-rnaseq:0.1.0|packages/api/tool-images/pydeseq2-rnaseq"
)

for build in "${local_builds[@]}"; do
  image="${build%%|*}"
  context="${build#*|}"
  if docker image inspect "$image" >/dev/null 2>&1; then
    echo "Already present: $image"
    continue
  fi
  echo "Building: $image"
  docker build -t "$image" "$context"
done

echo "Tool images prepared."
