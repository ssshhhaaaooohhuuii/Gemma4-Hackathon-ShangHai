#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   bash scripts/package-submission.sh
#
# 作用：
#   生成比赛公开提交目录，默认输出到：
#   .review-data/submission/CrossReaction-Gemma4-Agent
#
# 注意：
#   该目录会排除 .agentdocs、.review-data、node_modules、dist、.env 等本地文件。
#   生成后可在输出目录中运行 bash scripts/check-review-package.sh 进行边界检查。

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_DIR="${1:-.review-data/submission/CrossReaction-Gemma4-Agent}"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

rsync -a \
  --exclude '.git' \
  --exclude '.agentdocs' \
  --exclude '.review-data' \
  --include '.env.example' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'node_modules' \
  --exclude 'packages/*/node_modules' \
  --exclude 'packages/*/dist' \
  --exclude 'packages/llm-engine/.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.pytest_cache' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  ./ "$OUTPUT_DIR"/

echo "Submission package prepared at: $OUTPUT_DIR"
echo "Run boundary check:"
echo "  cd $OUTPUT_DIR && bash scripts/check-review-package.sh"
