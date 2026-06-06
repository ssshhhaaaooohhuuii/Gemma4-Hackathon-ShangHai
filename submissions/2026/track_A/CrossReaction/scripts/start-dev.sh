#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   bash scripts/start-dev.sh
#
# 作用：
#   在后台启动完整评审服务，包括 LLM engine、API server 和 Web UI。
#   PID 写入 .review-data/pids/，日志写入 .review-data/logs/。
#
# 查看日志：
#   tail -f .review-data/logs/web.log
#   tail -f .review-data/logs/api.log
#   tail -f .review-data/logs/llm-engine.log
#   tail -f .review-data/logs/prepare-tool-images.log
#
# 停止服务：
#   bash scripts/stop-dev.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PID_DIR=".review-data/pids"
LOG_DIR=".review-data/logs"
LEGACY_PID_FILE=".review-data/dev.pid"

mkdir -p "$PID_DIR" "$LOG_DIR"

if [[ -f "$LEGACY_PID_FILE" ]]; then
  old_pid="$(cat "$LEGACY_PID_FILE")"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" >/dev/null 2>&1; then
    echo "A legacy pnpm dev process appears to be running. PID: $old_pid"
    echo "Stop it first with: bash scripts/stop-dev.sh"
    exit 1
  fi
  rm -f "$LEGACY_PID_FILE"
fi

start_service() {
  local name="$1"
  local command="$2"
  local pid_file="$PID_DIR/$name.pid"
  local log_file="$LOG_DIR/$name.log"

  if [[ -f "$pid_file" ]]; then
    local old_pid
    old_pid="$(cat "$pid_file")"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" >/dev/null 2>&1; then
      echo "$name already appears to be running. PID: $old_pid"
      return
    fi
    rm -f "$pid_file"
  fi

  nohup bash -lc "$command" >"$log_file" 2>&1 &
  local pid="$!"
  disown "$pid" 2>/dev/null || true
  echo "$pid" >"$pid_file"
  echo "Started $name. PID: $pid, log: $log_file"
}

echo "Building API and Web UI before starting review services..."
pnpm --filter @gemma-demo/api build
pnpm --filter @gemma-demo/web build

echo "Preparing Docker tool images. Log: $LOG_DIR/prepare-tool-images.log"
bash scripts/prepare-tool-images.sh >"$LOG_DIR/prepare-tool-images.log" 2>&1

start_service "llm-engine" "cd packages/llm-engine && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8011"
start_service "api" "cd packages/api && node dist/index.js"
start_service "web" "cd packages/web && ./node_modules/.bin/vite preview --host 0.0.0.0 --port 5178"

sleep 1

failed=0
for pid_file in "$PID_DIR"/*.pid; do
  service_name="$(basename "$pid_file" .pid)"
  pid="$(cat "$pid_file")"
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "$service_name failed to stay running. Check $LOG_DIR/$service_name.log" >&2
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "Dev services started in background."
echo "Web UI: http://127.0.0.1:5178"
echo "API: http://127.0.0.1:3101"
echo "LLM engine: http://127.0.0.1:8011"
echo "Docker image preparation log: $LOG_DIR/prepare-tool-images.log"
