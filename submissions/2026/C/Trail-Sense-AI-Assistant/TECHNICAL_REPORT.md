# Trail Sense AI Assistant 技术报告

## 1. 背景与问题

户外场景中的用户经常面对三个问题：工具很多但不知道该用哪一个、传感器读数难以解释、紧急情况下需要快速执行正确动作。传统聊天机器人依赖云端服务，不适合无网络、弱网络或涉及位置隐私的徒步和生存场景。

Trail Sense AI Assistant 的目标是在 Android 手机上本地运行 Gemma 4，把自然语言助手和 Trail Sense 原有离线工具结合起来，让用户在野外仍然可以获得工具推荐、读数解释和应急操作指导。

## 2. 模型选型

默认模型选择 `Gemma-4-E2B-it`，原因是：

- 端侧可行性：模型体积和运行成本更适合 Android 手机。
- 指令能力：适合工具使用说明、步骤解释和安全提醒。
- LiteRT-LM 兼容：可通过 `com.google.ai.edge.litertlm:litertlm-android` 在移动端加载。
- 隐私适配：推理在本机完成，避免上传位置、路径、传感器和图片数据。

项目同时预留 `Gemma-4-E4B-it` 作为高性能设备上的可选模型。

## 3. 系统架构

整体架构分为五层：

1. UI 层：`AiAssistantFragment` 提供聊天、历史记录、图片附件和工具行动卡片。
2. 推理层：`AiInferenceSubsystem` 负责 LiteRT-LM `Engine` 初始化、Conversation 创建、图片压缩和消息发送。
3. 模型层：`ModelManager` 负责 Gemma 4 模型选择、断点续传下载、本地路径管理和删除。
4. 工具调用层：`AiAssistantTools` 将 Trail Sense 能力注册为 LiteRT-LM `ToolProvider`。
5. 应用上下文层：`TrailSenseAiToolRunner` 和各类 context provider 读取天气、导航、云识别、信标、路径等应用数据。

核心链路：

```text
User message
  -> AiPromptBuilder builds safety/system context
  -> AiInferenceSubsystem creates LiteRT-LM conversation
  -> Gemma 4 chooses text answer or native tool call
  -> AiAssistantTools dispatches tool call
  -> TrailSenseAiToolRunner reads local Trail Sense data or prepares action
  -> UI renders answer plus optional action card
```

## 4. Gemma 4 与 Native Function Calling

项目不是只做 Prompt 工程，而是让 Gemma 4 通过 LiteRT-LM 的工具接口访问 App 内能力。

已接入的能力包括：

- 读取天气和气压上下文，用于解释趋势和风险。
- 读取导航、路径、信标等上下文，用于定位和行动建议。
- 读取云识别相关上下文，用于天气观察解释。
- 准备 SOS 手电筒、哨子等应急行动卡片。
- 返回“打开某个 Trail Sense 工具”的导航动作。

工具调用均通过本地代码执行，AI 不直接伪造传感器读数。系统提示会要求模型优先使用工具上下文，并在不确定时明确说明限制。

## 5. Edge AI 部署

项目运行方式：

- 首次进入 AI 设置页时下载 Gemma 4 LiteRT-LM 模型。
- 模型文件存储在 App 私有目录 `ai_models`。
- 后续推理直接在设备本地运行。
- GPU 后端优先，失败后自动回退 CPU 后端。
- 图像附件会缩放到移动端模型可接受尺寸，减少内存压力。

与云端方案相比，本项目的优势是：

- 无网络时仍可使用 AI 助手。
- 用户位置、路线、聊天、传感器数据不上传。
- 与 Trail Sense 原有离线工具体验一致。

## 6. 数据合规与隐私

Trail Sense 原始应用中的位置、路径、气压、天气历史等数据本来就主要保存在本地。本项目延续该原则：

- AI 推理不调用云端 LLM API。
- 聊天历史保存在本地 Room 数据库。
- 模型下载需要网络，但下载流程不上传用户上下文。
- 工具调用只读取本机 App 数据。
- 图片附件只进入本机推理流程。

## 7. 验证

已执行验证：

```bash
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
```

当前结果：

- 单元测试通过，包括 AI Prompt、工具知识匹配、工具技能解析、模型管理、工具执行服务和天气上下文测试。
- Debug APK 构建通过，输出路径为 `app/build/outputs/apk/debug/app-debug.apk`。

## 8. 当前限制与后续计划

当前限制：

- Gemma 4 模型体积较大，首次下载需要稳定网络。
- 低端 Android 设备可能只能使用 CPU 后端，响应速度受限。
- 多模态工作流已具备图片输入入口，但不同设备上的实际推理效果仍需更多实测。

后续计划：

- 增加更多 Trail Sense 工具的只读上下文 provider。
- 增加端侧工具调用日志截图和演示样例。
- 针对户外安全问题增加更严格的风险提示模板。
- 优化模型下载校验、磁盘空间提示和弱网恢复。

