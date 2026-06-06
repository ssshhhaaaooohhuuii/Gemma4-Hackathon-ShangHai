#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   bash scripts/stop-dev.sh
#
# 作用：
#   停止由 scripts/start-dev.sh 后台启动的完整开发服务。
#   脚本会读取 .review-data/pids/ 下的 PID，并递归停止每个 PID 下的子进程。
#
# 若需要确认端口是否释放：
#   lsof -i :5178 -i :3101 -i :8011

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PID_DIR=".review-data/pids"
LEGACY_PID_FILE=".review-data/dev.pid"

kill_tree() {
  local root_pid="$1"
  local child_pid

  while IFS= read -r child_pid; do
    [[ -n "$child_pid" ]] || continue
    kill_tree "$child_pid"
  done < <(pgrep -P "$root_pid" 2>/dev/null || true)

  kill "$root_pid" >/dev/null 2>&1 || true
}

stop_pid_file() {
  local pid_file="$1"
  local service_name
  local pid

  service_name="$(basename "$pid_file" .pid)"
  pid="$(cat "$pid_file")"

  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    echo "$service_name PID file was empty. Removed $pid_file."
    return
  fi

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    rm -f "$pid_file"
    echo "$service_name process $pid is not running. Removed stale PID file."
    return
  fi

  kill_tree "$pid"

  for _ in {1..20}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -TERM "$pid" >/dev/null 2>&1 || true
  fi

  rm -f "$pid_file"
  echo "Stopped $service_name."
}

found=0

if [[ -d "$PID_DIR" ]]; then
  for pid_file in "$PID_DIR"/*.pid; do
    [[ -e "$pid_file" ]] || continue
    found=1
    stop_pid_file "$pid_file"
  done
fi

if [[ -f "$LEGACY_PID_FILE" ]]; then
  found=1
  stop_pid_file "$LEGACY_PID_FILE"
fi

if [[ "$found" -eq 0 ]]; then
  echo "No PID files found. Nothing to stop."
else
  echo "Dev services stopped."
fi
