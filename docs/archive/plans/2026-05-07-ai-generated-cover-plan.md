# AI 生图封面功能计划

## 背景

当前后台已有：

- AI 模型配置页：`/admin/ai/models`
- 模型数据表：`AiModel`
- 模型能力字段：`capabilities String[]`
- 文章编辑页封面入口：
  - 直接填写封面 URL
  - 上传到七牛并入库
  - 从封面图库 `CoverPicker` 选择
- 封面图库表：`CoverAsset`
  - 已有 `source`，允许 `upload | manual | ai`
  - 已有 `aiPrompt`、`aiModelId`、`metadata`

因此本次不需要新增封面资产表，重点是扩展模型能力、增加图片生成调用链，并在文章封面选择区域加入 AI 生图入口。

## 目标

1. 在模型配置中支持图片生成模型。
2. 新增一个内置千问生图模型：`wan2.6-image`。
3. 文章编辑/新建页的封面区域增加“AI 生成封面”。
4. 生成后的图片保存到七牛，并创建 `CoverAsset` 记录。
5. 生成完成后自动回填文章 `coverImage` 和 `coverAssetId`。

## 非目标

第一阶段不做：

- 多图批量生成
- 生图任务队列
- 局部重绘/参考图重绘
- 成本统计
- 复杂尺寸管理面板
- 前台读者侧 AI 生图入口

## 设计方案

### 1. AI 模型能力扩展

当前：

```ts
export type AiModelCapability = "post-summary";
```

计划扩展为：

```ts
export type AiModelCapability = "post-summary" | "cover-image";
```

后台展示文案：

```ts
{
  "post-summary": "文章摘要",
  "cover-image": "封面生图"
}
```

`AiModel.capabilities` 数据库字段已是 `String[]`，不需要结构迁移。

### 2. 默认模型策略

目前只有：

```prisma
isDefaultForSummary Boolean @default(false)
```

为了避免立即做 schema 改造，第一阶段不新增 `isDefaultForCoverImage` 字段。

默认选择策略：

1. 优先选择 ready 且 capabilities 包含 `cover-image` 的环境模型 `qwen-wan2.6-image`
2. 如果用户手动选择模型，则使用请求中的 `modelId`
3. 如果没有可用模型，API 返回明确错误

后续如果需要“设为封面默认模型”，再增加字段：

```prisma
isDefaultForCoverImage Boolean @default(false)
```

### 3. 新增内置千问生图模型

新增环境模型：

```ts
const ENV_COVER_IMAGE_MODEL_ID = "qwen-wan2.6-image";
const DASH_SCOPE_IMAGE_MODEL = "wan2.6-image";
```

建议环境变量：

```env
AI_IMAGE_DASHSCOPE_API_KEY=xxx
AI_IMAGE_DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1
AI_IMAGE_DASHSCOPE_MODEL=wan2.6-image
```

如果实际 Wan 2.6 Image 使用 DashScope 兼容 OpenAI Images API，则可调整为：

```env
AI_IMAGE_DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_IMAGE_DASHSCOPE_REQUEST_PATH=/images/generations
```

实现前需要确认阿里云 DashScope `wan2.6-image` 的真实 HTTP 协议、返回字段和图片 URL / base64 格式。

### 4. 模型配置 UI 改造

文件：

- `src/components/admin/ai/AiModelManager.tsx`
- `src/app/admin/ai/models/page.tsx`
- `src/lib/ai-models.ts`
- `src/app/api/admin/ai/models/default/route.ts`（第一阶段可不改默认逻辑）

改造点：

- 新增模型表单能力选择：
  - 文章摘要
  - 封面生图
- 自定义模型创建/编辑时允许 `capabilities: ["cover-image"]`
- 模型列表显示“封面生图”能力标签
- 页面说明从“摘要模型”改为“后台 AI 能力模型”
- 测试接口根据能力类型选择不同测试方式：
  - `post-summary`：沿用 chat completions 测试
  - `cover-image`：使用图片生成测试，或第一阶段只验证配置完整并提示“图片模型将在生成时测试”

### 5. 新增图片生成服务

建议新增：

```txt
src/lib/ai-cover-image.ts
```

职责：

- 根据 `modelId` 获取可用 `cover-image` 模型
- 构造生图 prompt
- 调用千问 / DashScope 图片生成接口
- 解析返回图片
- 如果返回远程 URL：下载图片
- 如果返回 base64：转 Buffer
- 上传到七牛
- 创建 `CoverAsset`，`source: "ai"`

核心函数草案：

```ts
export async function generateAiCoverImage(input: {
  title: string;
  excerpt?: string | null;
  content?: string | null;
  prompt?: string | null;
  modelId?: string | null;
  size?: "16:9" | "1:1" | "4:3";
  createdById: string;
}) {
  // returns CoverAsset
}
```

Prompt 建议：

- 基于文章标题、摘要、可选补充 prompt
- 强制避免文字、Logo、水印
- 偏博客封面构图
- 默认 16:9

示例：

```txt
Create a high-quality editorial blog cover image, cinematic but clean, 16:9 composition.
Topic: {title}
Context: {excerpt}
Style: modern technology editorial illustration, atmospheric lighting, no text, no logo, no watermark.
Additional direction: {prompt}
```

### 6. 七牛上传复用

当前已有上传 token API，但服务端生图后需要服务端直接上传到七牛。

建议新增：

```txt
src/lib/qiniu-server.ts
```

提供：

```ts
uploadBufferToQiniu(input: {
  buffer: Buffer;
  contentType: string;
  keyPrefix: "covers/ai";
  filename?: string;
}): Promise<{ url: string; key: string; width?: number; height?: number }>;
```

注意：

- 服务端上传不走浏览器 token
- key 建议：`covers/ai/{timestamp}-{random}.webp`
- 返回 URL 使用 `QINIU_DOMAIN`

### 7. 新增 API

新增：

```txt
src/app/api/admin/covers/generate/route.ts
```

请求：

```ts
POST /api/admin/covers/generate
{
  "title": "文章标题",
  "excerpt": "文章摘要",
  "content": "文章正文，可选，建议截断",
  "prompt": "额外风格要求，可选",
  "modelId": "qwen-wan2.6-image，可选",
  "size": "16:9"
}
```

响应：

```ts
{
  "success": true,
  "data": {
    "id": "cover_xxx",
    "url": "https://cdn.example.com/covers/ai/xxx.webp",
    "source": "ai",
    "aiPrompt": "...",
    "aiModelId": "qwen-wan2.6-image"
  }
}
```

安全：

- 必须 `requireAdminSession()`
- 加 rate limit，例如 5 次 / 分钟
- prompt/title/content 做长度限制
- 不记录 API Key
- 失败时返回安全错误，不泄露上游完整响应

### 8. 文章封面 UI 改造

位置：

```txt
src/components/posts/AdminPostWorkspace.tsx
src/components/admin/covers/CoverPicker.tsx 或新增 AiCoverGenerator.tsx
```

建议新增组件：

```txt
src/components/admin/covers/AiCoverGenerator.tsx
```

功能：

- “AI 生成封面”按钮
- 弹窗输入：
  - 风格提示词
  - 模型选择（只列出 `cover-image` 且 ready 的模型）
  - 尺寸默认 16:9
- 生成中 loading
- 生成成功预览
- 点击“使用这张封面”后回填

在 `AdminPostWorkspace` 中接入：

```tsx
<AiCoverGenerator
  title={formData.title}
  excerpt={formData.excerpt}
  content={formData.content}
  onGenerated={(asset) =>
    setFormData((prev) => ({
      ...prev,
      coverImage: asset.url,
      coverAssetId: asset.id,
    }))
  }
/>
```

### 9. 数据落库

生成成功后创建：

```ts
createCoverAsset({
  url,
  key,
  provider: "qiniu",
  source: "ai",
  status: "active",
  title: `${title} AI 封面`,
  alt: title,
  description: "AI 生成封面",
  tags: ["ai", "generated"],
  aiPrompt: finalPrompt,
  aiModelId: model.id,
  metadata: {
    model: model.model,
    size,
    upstreamProvider: "dashscope",
  },
  createdById,
})
```

## 实施步骤

### 阶段 1：模型能力扩展

1. 扩展 `AiModelCapability`：加入 `cover-image`
2. 修改 `normalizeCapabilities()` 支持新能力
3. 新增内置环境模型 `qwen-wan2.6-image`
4. 调整模型配置页面文案和能力标签
5. 表单增加能力选择，创建/编辑 payload 传递选择结果
6. 更新相关测试

### 阶段 2：生图服务和 API

1. 新增 `src/lib/ai-cover-image.ts`
2. 新增 `src/lib/qiniu-server.ts`
3. 新增 `POST /api/admin/covers/generate`
4. 添加 rate limit
5. 添加单元测试：
   - 未登录/非管理员拒绝
   - 无可用模型时报错
   - 上游失败时报错
   - 成功生成后上传七牛并创建 CoverAsset

### 阶段 3：文章编辑页接入

1. 新增 `AiCoverGenerator` 组件
2. 在 `AdminPostWorkspace` 封面区域加入入口
3. 生成成功自动回填 `coverImage` / `coverAssetId`
4. 更新组件测试

### 阶段 4：验证

执行：

```bash
pnpm prisma generate
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

手动验证：

1. `/admin/ai/models` 能看到 `wan2.6-image`
2. 配置 API Key 后模型状态为可用
3. 新建文章页点击“AI 生成封面”
4. 成功生成图片并上传七牛
5. 封面 URL 自动回填
6. 封面图库可看到 source 为 `ai` 的图片
7. 保存文章后前台详情页和列表页显示 AI 封面

## 风险与注意事项

### 1. DashScope Wan 2.6 Image 协议需确认

这是最大不确定项。实施前必须确认：

- endpoint
- request body
- 鉴权 header
- 返回图片 URL 还是 base64
- 是否异步任务制
- 模型名是否准确为 `wan2.6-image`

如果是异步任务制，需要 API 轮询或任务表。

### 2. 成本和滥用控制

生图比摘要更贵，必须加：

- admin 权限
- rate limit
- 明确 loading 状态
- 失败提示

### 3. 图片版权和内容安全

第一阶段至少在 prompt 中加入：

- no logo
- no watermark
- no text
- editorial illustration

后续可加入内容审核。

### 4. 图片存储

生成图片必须落到七牛，不能直接使用上游临时 URL，否则可能过期。

## 建议文件清单

预计新增：

- `src/lib/ai-cover-image.ts`
- `src/lib/qiniu-server.ts`
- `src/app/api/admin/covers/generate/route.ts`
- `src/app/api/admin/covers/generate/__tests__/route.test.ts`
- `src/components/admin/covers/AiCoverGenerator.tsx`
- `src/components/admin/covers/__tests__/AiCoverGenerator.test.tsx`

预计修改：

- `src/lib/ai-models.ts`
- `src/components/admin/ai/AiModelManager.tsx`
- `src/app/admin/ai/models/page.tsx`
- `src/components/posts/AdminPostWorkspace.tsx`
- `src/lib/rate-limit.ts`
- 相关测试文件

## 推荐验收标准

- 模型配置页支持 `cover-image` 能力
- 内置 `wan2.6-image` 出现在模型列表
- 文章封面区域有 AI 生图入口
- 生图成功后封面自动回填
- 生图结果保存到七牛和 `CoverAsset`
- 所有自动化验证通过
