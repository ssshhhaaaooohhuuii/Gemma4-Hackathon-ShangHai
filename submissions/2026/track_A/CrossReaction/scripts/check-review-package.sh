#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

forbidden_paths=(
  ".agentdocs"
  ".claude"
  "CLAUDE.md"
  "AGENTS.md"
  "packages/llm-engine/.venv"
  "workspaces"
  "outputs"
  "cas-artifacts"
  "postgres_data"
)

for path in "${forbidden_paths[@]}"; do
  if [[ -e "$path" ]]; then
    echo "Forbidden review package path exists: $path" >&2
    exit 1
  fi
done

forbidden_terms=(
  "OG""RE"
  "KE""LP"
  "Re""Code"
  "CAS ""Artifact"
  "cross_reaction""_client"
  "crossreaction""."
)

scan_targets=(
  "README.md"
  "REVIEW_BOUNDARY.md"
  "docs"
  "packages"
  "demo-data"
  "scripts"
)

required_files=(
  ".env.example"
  "README.md"
  "docs/TECHNICAL_REPORT.md"
  "docs/DOCKER_DEPLOYMENT.md"
  "packages/api/tool-images/pydeseq2-rnaseq/Dockerfile"
  "packages/web/public/brand/crossreaction-logo.png"
  "scripts/start-dev.sh"
)

for path in "${required_files[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "Required review package file is missing: $path" >&2
    exit 1
  fi
done

for term in "${forbidden_terms[@]}"; do
  if rg -n -F --hidden \
    --glob '!**/node_modules/**' \
    --glob '!**/dist/**' \
    --glob '!.review-data/**' \
    --glob '!packages/llm-engine/.venv/**' \
    "$term" "${scan_targets[@]}" >/tmp/gemma-review-scan.txt; then
    echo "Forbidden internal term found: $term" >&2
    cat /tmp/gemma-review-scan.txt >&2
    exit 1
  fi
done

if find . \
  -path './node_modules' -prune -o \
  -path './dist' -prune -o \
  -path './packages/*/dist' -prune -o \
  -path './packages/llm-engine/.venv' -prune -o \
  -path './.review-data' -prune -o \
  \( -name ".env" -o -name ".env.*" ! -name ".env.example" -o -name "*.pem" -o -name "*.key" \) -print | rg . >/tmp/gemma-review-secrets.txt; then
  echo "Potential secret file found:" >&2
  cat /tmp/gemma-review-secrets.txt >&2
  exit 1
fi

if find . \
  -path './node_modules' -prune -o \
  -path './dist' -prune -o \
  -path './packages/*/dist' -prune -o \
  -path './packages/llm-engine/.venv' -prune -o \
  -path './.review-data' -prune -o \
  \( -name "__pycache__" -o -name "*.pyc" -o -name ".pytest_cache" -o -name "*.log" -o -name "*.pid" \) -print | rg . >/tmp/gemma-review-generated.txt; then
  echo "Generated local file found:" >&2
  cat /tmp/gemma-review-generated.txt >&2
  exit 1
fi

echo "Review package check passed."
