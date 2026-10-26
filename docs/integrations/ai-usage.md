# AI 调用用量日志

## 查看调用记录

管理员打开「后台 → API 操作日志」，将范围筛选为 `ai-usage`。一条日志对应一个真实上游 HTTP 尝试；自动重试会产生同一个 `callId` 下不同 `attempt` 的独立记录，包含成功和失败尝试。

日志详情的 `metadata` 包含：

- `operation`：应用阶段，如 `ai.news.score`、`ai.news.draft`、`ai.post.summary`、`ai.model.probe`
- `startedAt`、`durationMs`、HTTP `statusCode`、错误分类、模型和供应商 hostname
- `usageReported` 及 `usage`：上游原样返回的 token 计数；没有计数时保存 `null`，不代表零 token
- `reasoning_tokens`：供应商返回的思考 token 子计数；没有单独字段时为 `null`
- `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`：供应商提供时记录缓存命中和未命中 token

费用依模型、时段、缓存计费规则而变化。现有记录不自行换算费用；请按所用供应商的价格表及账单确认。`usage` 不存在的历史记录不可追溯补齐。
不要让其他程序复用 blog Key：DeepSeek 用量页按 Key 汇总，不能仅凭账单分清 blog 与其他来源。

## 范围与限制

- OpenAI Chat Completions 兼容客户端的所有默认请求和重试，以及文章摘要和模型连接测试这些单次调用路径都会留记录。经注入 fake `fetchImpl` 的测试请求不写生产日志。
- DeepSeek `reasoning_tokens` 只在上游响应公开该数字时可用。上游不返回 `usage` 的调用、拒绝请求或超时会保留未知值，而不是推算用量。
- 图片生成使用单独的图像协议，不产生 Chat Completions token 计数。直接 AI Agent 创建草稿与接入模型的草稿自动审稿也不是同一模型网关调用；本日志仅统计其中经过统一模型客户端的上游请求。
- 日志不保存 prompt、文章正文、API Key、Key 哈希或 provider 原始错误正文；日志写入失败不会使模型请求失败。
- `callId` 是应用生成的单次逻辑调用 ID；`attempt` 是此逻辑调用内部从 1 开始的上游尝试序号。不同模型调用可能使用新逻辑 ID，不将 HTTP 请求体或输入文本重复写入日志。
