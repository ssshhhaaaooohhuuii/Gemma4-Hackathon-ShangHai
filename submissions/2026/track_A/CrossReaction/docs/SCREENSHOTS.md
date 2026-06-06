# Screenshot Checklist / 截图清单

## 中文版本

提交前建议截图：
- [ ] 右上角本地 Gemma 4 模型状态。
- [ ] Agent state 显示 `Native guided tool calling`。
- [ ] Tool Calls 列表显示 `select_workflow`，且 `origin=model_native`。
- [ ] Tool Calls 列表显示 `inspect_sample_data` 和 `draft_execution_plan`，且 `origin=system_grounding`。
- [ ] Memory 显示 selected workflow、observed public files、recorded tool call IDs、安全规则。
- [ ] Execution timeline 显示 Docker steps。
- [ ] Result tables 和 report。
- [ ] `.review-data/jobs/<jobId>/agent-memory.json`。
- [ ] `.review-data/jobs/<jobId>/tool-calls.json`。
- [ ] `.review-data/jobs/<jobId>/agent-trace.json`。
- [ ] 终端 `tail -f .review-data/logs/prepare-tool-images.log`，展示 Docker 镜像拉取/构建。
- [ ] 终端 `tail -f .review-data/logs/api.log`，展示 API 启动和任务请求。
- [ ] 终端 `tail -f .review-data/logs/llm-engine.log`，展示 Gemma 4 `/chat` 请求。

截图方法：
- macOS：`Cmd + Shift + 4` 截取选区，或使用 Screenshot 录屏工具。
- 终端日志：先运行上面的 `tail -f ...` 命令，再截图终端窗口。
- Agent artifacts：任务完成后打开 `.review-data/jobs/<jobId>/`，用编辑器或终端 `sed -n '1,120p' <file>` 展示文件内容后截图。

## English Version

Recommended screenshots before submission:
- [ ] Top-right local Gemma 4 model indicator.
- [ ] Agent state showing `Native guided tool calling`.
- [ ] Tool Calls list showing `select_workflow` with `origin=model_native`.
- [ ] Tool Calls list showing `inspect_sample_data` and `draft_execution_plan` with `origin=system_grounding`.
- [ ] Memory showing selected workflow, observed public files, recorded tool call IDs, and safety rules.
- [ ] Execution timeline with Docker steps.
- [ ] Result tables and report.
- [ ] `.review-data/jobs/<jobId>/agent-memory.json`.
- [ ] `.review-data/jobs/<jobId>/tool-calls.json`.
- [ ] `.review-data/jobs/<jobId>/agent-trace.json`.
- [ ] Terminal `tail -f .review-data/logs/prepare-tool-images.log`, showing Docker image pull/build logs.
- [ ] Terminal `tail -f .review-data/logs/api.log`, showing API startup and task requests.
- [ ] Terminal `tail -f .review-data/logs/llm-engine.log`, showing Gemma 4 `/chat` requests.

How to capture:
- macOS: use `Cmd + Shift + 4` for area screenshots, or the Screenshot app for screen recording.
- Runtime logs: run the `tail -f ...` commands above, then capture the terminal window.
- Agent artifacts: after a task completes, open `.review-data/jobs/<jobId>/` and show files in an editor or with `sed -n '1,120p' <file>` before taking screenshots.
