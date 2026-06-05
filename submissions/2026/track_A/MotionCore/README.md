# 🧠 MotionCore · AI 运动分析

MotionCore 是一套面向大众与职业体育的通用运动计算平台：对普通用户，它是能实时诊断动作问题的 AI 私教；对职业队，它是具备战术理解能力的 AI 教练系统。  

此Demo仅演示**双视频舞蹈对比**和**足球战术分析**，以流式方式生成 AI 报告，并自动进行音频对齐。  
系统内置 **Gemma 4 驱动的智能体（Agent）**，展示原生函数调用、多步推理与工具使用能力。

---

## 🎬 演示视频

https://github.com/user-attachments/assets/c9d0299a-1ecc-4ab8-b648-b82bf5047477

https://github.com/user-attachments/assets/a10fdaf3-d572-4212-af60-ae2e17013359

---

## ✨ 功能特性

- **双视频舞蹈分析**  
  上传两段舞蹈视频，自动提取 3D 骨骼序列（MediaPipe），音频对齐后生成同步对比播放器。
- **足球战术分析**  
  上传比赛视频，检测球员和足球（YOLO + BotSORT），跟踪运动轨迹，生成包含阵型、控球和关键球员的战术报告。
- **Gemma 4 智能体模式**  
  使用 Gemma 4 时，系统会激活多步智能体，调用工具（`get_pose_summary`、`compare_videos` 等）收集数据，再生成最终报告。完整决策日志会被保存，确保过程透明。
- **流式 SSE 报告**  
  实时的逐字 AI 反馈，以聊天式界面展示。
- **自动音频对齐**  
  根据音轨对齐两段舞蹈视频，实现完美的左右同步对比。
- **双语界面与报告**  
  支持中文和英文界面及分析语言切换。
- **进度追踪**  
  处理进度条，显示已用时间和预计剩余时间。
- **可复制报告**  
  AI 生成的分析内容可一键复制。

---

## 🧰 技术栈

| 层级          | 技术                            |
| ------------- | ------------------------------- |
| 前端          | HTML5, CSS3, JavaScript（原生） |
| 后端          | FastAPI（Python）               |
| 姿态估计      | MediaPipe Pose                  |
| 球员/足球检测 | YOLOv8 + BotSORT                |
| 音频对齐      | MoviePy + NumPy                 |
| 大模型集成    | OpenAI SDK（Gemma 4）           |
| 计算机视觉    | OpenCV                          |
| 环境变量      | python-dotenv                   |

---

## 📦 安装与配置

### 1. 进入项目

```bash
cd motioncore
```

### 2. 设置虚拟环境（推荐）

```bash
# Windows
conda create -n motion python=3.10 -y
conda activate motion
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 配置环境变量

复制模板并编辑 `.env` 文件：

```bash
cp .env.example .env
```

填入你的 API 密钥：

```ini
LLM_PROVIDER=gemma4

# Gemma 4 通过 Google AI Studio（国内用户需代理）
GEMMA_API_KEY=你的谷歌API密钥
GEMMA_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMMA_MODEL=gemma-4-31b-it
```

**中国用户须知：**  

- 中国用户需要 VPN/代理，在 `.env` 中设置 `HTTPS_PROXY=http://127.0.0.1:你的VPN端口`，或cmd中运行

  ```bash
  set HTTPS_PROXY=http://127.0.0.1:你的VPN端口
  ```


### 5. 启动服务

```bash
python main.py
```

访问 `http://127.0.0.1:8000` 进入舞蹈分析模块，`http://127.0.0.1:8000/web2` 进入足球分析模块。

---

## 🚀 使用说明

### 舞蹈分析

1. 打开舞蹈分析页面。
2. 上传两个视频：**视频 A**（用户动作）和 **视频 B**（教学参考）。
3. 系统处理视频，提取骨骼数据，自动启动 AI 分析。
4. 在聊天窗口查看流式报告。
5. 报告完成后，底部会出现**同步双视频播放器**，支持音频对齐播放。

### 足球分析

1. 打开足球分析页面。
2. 上传一个比赛视频。
3. 系统检测球员和足球，跟踪位置，生成战术报告。
4. 报告包含阵型、控球情况、关键球员，处理过程中会显示小地图叠加层。

---

## 📂 项目结构

```
motioncore/
├── main.py                 # 主入口，挂载 /web 和 /web2
├── .env.example            # 环境变量模板
├── requirements.txt        # 依赖列表
├── README.md               # 本文件
├── web/                    # 舞蹈分析应用
│   ├── api/
│   │   ├── app.py          # FastAPI 端点（上传、流式、分析）
│   │   ├── client.py       # LLM 流式客户端（标准 + 智能体）
│   │   ├── agent_tools.py  # 智能体工具（获取姿态摘要、视频对比）
│   │   ├── prompts_zh.py   # 中文舞蹈分析提示词
│   │   └── prompts_en.py   # 英文舞蹈分析提示词
│   └── h5/
│       ├── index.html      # 舞蹈前端界面
│       └── favicon.ico
├── web2/                   # 足球分析应用
│   ├── api/
│   │   ├── app.py          # 足球 FastAPI 端点
│   │   ├── client.py       # LLM 流式客户端（标准 + 智能体）
│   │   ├── agent_tools.py  # 足球智能体工具（球队摘要、球员轨迹）
│   │   ├── processor.py    # YOLO + 跟踪 + 分析核心
│   │   ├── prompts_zh.py   # 中文足球提示词
│   │   └── prompts_en.py   # 英文足球提示词
│   ├── h5/
│   │   ├── index.html      # 足球前端界面
│   │   └── favicon.ico
│   └── model/
│       └── yolov8n.pt      # YOLO 模型权重
└── outputs/                # 运行时生成：上传视频、JSON 数据、智能体日志、对话日志
```

---

## 🧠 Gemma 4 智能体架构

当 `LLM_PROVIDER=gemma4` 时，系统会激活**智能体模式**，展示原生函数调用能力：

1. **步骤 1 – 指令与请求：** 将系统提示词和用户请求发送给 Gemma 4。
2. **步骤 2 – 智能体思考与决策：** 模型思考并决定调用哪些工具（`get_pose_summary`、`compare_videos` 等）。
3. **步骤 3 – 工具执行：** 系统执行选中的工具，记录返回的 JSON 数据及解读。
4. **步骤 4 – 数据整合：** 将完整的姿态序列（或比赛数据）注入分析提示词，并保存完整提示词为对话日志。
5. **步骤 5 – 报告生成：** Gemma 4 生成最终的流式报告（如流式失败则回退至非流式模式）。

所有决策步骤都会记录在 `agent_log_*.txt` 中，便于展示和审计。

---

## 🌐 语言切换

点击任意界面右上角的语言切换按钮（中文 / English），即可切换界面语言和 AI 报告语言。  
在英文模式下，系统指令会强制模型使用英文回复。

---

## 🔌 API 端点（舞蹈）

| 方法 | 路径                      | 说明                      |
| ---- | ------------------------- | ------------------------- |
| POST | `/web/upload`             | 上传视频，返回 `task_id`  |
| GET  | `/web/stream/{task_id}`   | 处理过程中的 MJPEG 视频流 |
| GET  | `/web/progress/{task_id}` | 查询处理进度              |
| GET  | `/web/status/{task_id}`   | 获取完成状态和下载链接    |
| POST | `/web/analyze/stream`     | 流式分析（SSE）           |
| GET  | `/web/audio-offset`       | 计算音频对齐偏移量        |

足球分析端点类似，位于 `/web2/*` 下。

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。