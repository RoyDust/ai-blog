# Issue #14 外部调用可靠性实施 Spec

## 范围

只收口当前后端已有的 OpenAI-compatible 文本 Completion、外部内容 GET 和图片响应边界。保持现有业务模块、Prisma 模型、测试注入入口和图片供应商协议不变。

## 已完成

- `external-reliability.ts`：有界响应读取、HTTP/网络/超时分类、脱敏、Retry-After、有限重试与 full jitter。
- `openai-compatible-completion-client.ts`：统一 Chat Completions 请求、2 MiB 成功体 / 64 KiB 错误体、model-probe / interactive / long 三档预算；POST 超时不重试。
- `external-content-client.ts`：仅 HTTP/HTTPS GET、30 秒总预算、12 秒 attempt、最多 3 次、最多 3 次重定向，跨 origin 清理凭据头，5 MiB 成功体 / 64 KiB 错误体。
- 已迁移默认生产路径：文章摘要、模型连通性、文章 AI 动作、文章审稿、文章元数据、站内搜索、AI 日报评分、语义去重、事实卡、编辑汇总、日报草稿。
- AI 日报 RSS 默认抓取已接入 `ExternalContentClient`；测试传入的 `fetchImpl` 继续保留，避免改变测试 seam。
- 图片 JSON 响应改为 2 MiB 有界读取；base64 解码和图片下载均限制 20 MiB；图片仍保持独立协议，不复用 Completion Client。

## 部分完成

- Hacker News 与 GitHub 来源在当前变更中仍保留原始 `fetchImpl` 分支；RSS 已完成统一客户端迁移。若继续收口，应先补齐状态码 fallback 语义测试，再迁移 HN/GitHub，避免破坏 GitHub API → Atom fallback。
- 图片轮询、图片下载 GET 尚未接入统一的 3 次 retry policy；当前已具备超时和响应大小边界。提交 POST 仍保持单次。
- 部分业务模块在传入自定义 `fetchImpl` 时保留旧解析路径，仅默认生产路径走统一客户端。这是兼容测试和调用方的最小实现，不应被误判为生产绕过。

## 明确不做

- 不引入通用 AI Gateway。
- 不把图片生成迁移到文本 Completion Client。
- 不做 token / 价格统计、OpenTelemetry、通用取消系统、持久化重试队列或 Prisma schema 迁移。

## 验证状态

- `pnpm exec tsc --noEmit`：通过。
- Issue #14 相关定向 Vitest：72 项通过。
- `pnpm lint`：0 error；仅已有复杂度/函数长度 warning。
- 未宣称 `pnpm build`、全量测试或 PostgreSQL/Docker 集成测试通过；这些需要单独环境验证。

## 对抗性审查结论

- 需要修改：统一外部协议边界、限制响应体、区分可重试错误，能直接降低重复实现和失控响应风险。
- 最小实现：客户端只负责传输、预算、重试和响应上限；业务 JSON/schema 解析仍在领域模块；测试注入入口保留。
- 架构影响：未引入业务依赖到基础层，未改变数据库模型和路由契约。剩余部分按“部分完成”处理，不以迁移覆盖率替代行为验证。