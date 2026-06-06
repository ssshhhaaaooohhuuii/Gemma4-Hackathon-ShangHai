# Review Boundary / 评审边界

## 中文版本

本文件说明本次比赛提交的评审范围。该项目面向评委提供可 clone、可检查、可运行的公开实现，用于展示 Gemma 4 Agent 在生物医学计算分析场景中的能力。

本仓库包含：
- Gemma 4 OpenAI-compatible provider 集成。
- 公开 synthetic sample bulk RNA-seq、single-cell RNA-seq、proteomics 数据。
- 轻量 Web UI、API server 和 LLM adapter。
- 可复现 workflow pipeline 代码。
- Public review Agent runtime、tool-call transcript 和 task memory artifacts。

本提交范围不包括：
- 商业版 CrossReaction 平台的生产架构和内部编排系统。
- 私有数据、私有容器镜像、私有文档和生产凭据。
- 真实客户数据或生产部署配置。
- 本地开发辅助文档 `.agentdocs`；提交包生成脚本会排除该目录。

Public review Agent runtime 是为本次比赛评审设计的可审计实现。它暴露公开 workflow contracts、公开 synthetic sample data、公开 container names、任务级 memory 和 review trace artifacts。该 runtime 用于说明本提交中的 Agent Memory 与 Tool Calling 逻辑，并不代表商业版 CrossReaction 平台的生产编排架构。

## English Version

This document defines the review scope of the competition submission. The project provides a public implementation that reviewers can clone, inspect, and run to evaluate Gemma 4 Agent capabilities in computational biomedical analysis.

Included in this repository:
- Gemma 4 OpenAI-compatible provider integration.
- Public synthetic sample bulk RNA-seq, single-cell RNA-seq, and proteomics data.
- A lightweight Web UI, API server, and LLM adapter.
- Reproducible workflow pipeline code.
- Public review Agent runtime, tool-call transcript, and task memory artifacts.

Excluded from the submission scope:
- Production architecture and internal orchestration systems from the commercial CrossReaction platform.
- Private data, private container images, private documents, and production credentials.
- Real customer data or production deployment configuration.
- Local development assistant documentation under `.agentdocs`; the submission packaging script excludes that directory.

The public review Agent runtime is an auditable implementation designed for this competition submission. It exposes public workflow contracts, public synthetic sample data, public container names, task-scoped memory, and review trace artifacts. This runtime explains the Agent Memory and Tool Calling logic in the submission; it is not the production orchestration architecture of the commercial CrossReaction platform.
