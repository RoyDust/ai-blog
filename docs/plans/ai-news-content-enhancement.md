# AI 日报内容增强 — 实施计划

> 创建日期：2026-05-12
> 状态：待执行

## 1. 背景与问题

当前 AI 日报生成管道输出过于简短。每条新闻仅渲染为单行 bullet，`FactCard` 中已由 AI 生成的富文本字段（`whatHappened`、`whyItMatters`、`keyDetails` 等）在渲染阶段被丢弃不用。用户需要更详细的内容：

- **今日摘要**：开篇 2-4 句概述当日 AI 领域格局
- **重点新闻详细展开**：每条包含描述段落 + 【提要】要点列表 + 来源链接
- **趋势总结**：综合当日新闻，总结 3-5 条形态发展趋势

## 2. 目标输出格式

```markdown
欢迎来到【AI日报】栏目！这里是你每天探索人工智能世界的指南，
每天我们为你呈现AI领域的热点内容，聚焦开发者，助你洞悉技术趋势、
了解创新AI产品应用。

1、OpenAI 发布三款实时语音模型，针对推理对话、实时翻译和实时转录

OpenAI 推出了三款新型实时语音模型，旨在为开发者提供更先进的语音
应用解决方案。这些模型分别针对不同的应用场景...

【AiBase提要:】

🔊 GPT-Realtime-2 具备高级推理能力，实现更自然的实时对话。
🌐 GPT-Realtime-Translate 支持多种语言，提供接近同声传译的翻译体验。
📝 GPT-Realtime-Whisper 实现低延迟转录，适用于直播和会议记录等场景。

> 来源：OpenAI Blog

2、苹果首款AI硬件曝光：带摄像头的AirPods已进入 DVT 阶段
...

## 今日趋势总结

综合今日动态，AI 领域呈现以下趋势：
1. **语音与多模态交互加速落地** — ...
2. **AI 硬件生态持续扩张** — ...
3. **安全与合规成为基础能力** — ...
4. **开发者工具链日趋成熟** — ...

---

> 生成标注：本文由 AI 模型 ...
```

## 3. 数据流分析

```
源 RSS → parseNewsFeed → AiNewsItem
  → scoreAiNewsCandidate → AiNewsScoredCandidate (aiScore/aiSummary/aiTags)
  → generateFactCardForCandidate → AiNewsEnrichedFactCard
      ├── whatHappened     ← 已生成，未渲染 ❌
      ├── whyItMatters     ← 已生成，未渲染 ❌
      ├── keyDetails[]     ← 已生成，未渲染 ❌
      ├── communityDiscussion ← 已生成，未渲染 ❌
      └── citations[]      ← 用于来源链接 ✅
  → renderDailyAiNewsMarkdown → 最终 Markdown
```

**核心问题**：`renderDailyAiNewsMarkdown` 中 `renderBullet()` 只取 `candidateSummary()`（优先候选 aiSummary），完全忽略了 factCard 的富文本字段。

## 4. 实施步骤

### Step 1：重写渲染器 `src/lib/ai-news-renderer.ts`

这是核心改动，决定最终输出效果。

#### 1.1 新增欢迎引言

```typescript
function renderWelcomeIntro(date: Date): string {
  const dateLabel = formatDate(date)
  return [
    `欢迎来到【AI日报】栏目！这里是你每天探索人工智能世界的指南，每天我们为你呈现AI领域的热点内容，聚焦开发者，助你洞悉技术趋势、了解创新AI产品应用。`,
  ].join("\n")
}
```

#### 1.2 新增结构化新闻条目渲染

```typescript
type NewsItemRendererInput = {
  fact: CandidateFact
  displayLabels: CandidateDisplayLabels
  index: number
}

function renderNewsItem({ fact, displayLabels, index }: NewsItemRendererInput): string {
  const { candidate, factCard } = fact
  const title = candidateDisplayTitle(fact)
  const description = factCard?.whatHappened || candidateSummary(fact)

  // 提要 — 优先用 factCard.keyDetails，回退到单行摘要
  const keyDetails = factCard?.keyDetails?.length
    ? factCard.keyDetails
    : [candidateSummary(fact)]

  const emojis = ["🔊", "🌐", "📝", "🧠", "🛡️", "🤖", "🔧", "🏗️", "📈", "🚀"]
  const detailLines = keyDetails.map(
    (detail, i) => `${emojis[i % emojis.length]} ${detail}`
  )

  const sourceName = factCard?.citations?.[0]?.sourceName || candidate.sourceName
  const sourceUrl = factCard?.citations?.[0]?.url || candidate.url

  return [
    `### ${index}、${title}`,
    "",
    description,
    "",
    "【AiBase提要:】",
    "",
    ...detailLines,
    "",
    `> 来源：[${escapeMarkdownInline(sourceName)}](${sourceUrl})`,
  ].join("\n")
}
```

#### 1.3 新增趋势总结生成

```typescript
function renderTrendSummary(candidateFacts: CandidateFact[]): string {
  // V1：基于 factCard.whyItMatters 和 aiTags 做规则拼合
  const trendCandidates = candidateFacts
    .filter(f => f.factCard?.whyItMatters)
    .map(f => ({
      tag: f.candidate.aiTags?.[0] || "general",
      why: f.factCard!.whyItMatters,
    }))

  // 按主题聚类，选出 3-5 条趋势
  // ...聚类逻辑...

  return [
    "## 今日趋势总结",
    "",
    "综合今日动态，AI 领域呈现以下趋势：",
    ...trends.map((t, i) => `${i + 1}. **${t.title}** — ${t.desc}`),
  ].join("\n")
}
```

#### 1.4 修改主渲染函数

```typescript
export function renderDailyAiNewsMarkdown(input: DailyAiNewsRendererInput): string {
  // ...现有分类逻辑保留...

  return [
    `# ${dateLabel} AI 日报`,
    "",
    renderWelcomeIntro(date),
    "",
    "## 今日重点",
    ...candidateFacts.map((f, i) => renderNewsItem({ fact: f, displayLabels, index: i + 1 })),
    "",
    renderTrendSummary(candidateFacts),
    "",
    "## 来源链接",
    ...sourceLines,
    "",
    "---",
    "",
    generatorAttribution,
  ].join("\n")
}
```

### Step 2：更新 draft-flow 兜底路径 `src/lib/ai-news-draft-flow.ts`

| 改动项 | 当前值 | 新值 | 说明 |
|--------|--------|------|------|
| `max_tokens` | `2400` | `6000` | 为详细内容留空间 |
| prompt 结构 | 单 content 字段 | 要求返回 `{title, excerpt, intro, items: [{title, description, keyPoints}], trends}` | 确保 legacy 模式也能生成结构化内容 |
| `parseDraftCandidate()` | 简单校验 | 适配新 JSON 字段 | 向下兼容旧格式 |

### Step 3：更新单元测试 `src/lib/__tests__/ai-news-renderer.test.ts`

| 测试 | 当前 | 改动 |
|------|------|------|
| `renders required markdown sections` | 检查 `## 最重要的 3 件事` 等 | 改为检查新板块名（`## 今日重点`、`【AiBase提要:】`、`## 今日趋势总结`） |
| `renders each selected story once` | 检查 `- **` 格式 bullet | 改为检查 `### N、` 格式标题 |
| `prefers Chinese summaries` | 不变 | 逻辑保留，断言不变 |
| `deduplicates repeated citation links` | 不变 | 逻辑保留 |
| `classifies ... into expected section` | 按板块分类 | 随板块逻辑调整 |
| 新增 | — | `renders news item with fact card key details as emoji bullets` |
| 新增 | — | `renders trend summary section when fact cards are available` |
| 新增 | — | `falls back to summary when fact card is missing` |

### Step 4：手动验证

1. 后台 AI 新闻页面手动触发一次生成
2. 检查生成的日报文章内容是否达到预期格式
3. 确认每条新闻的提要、描述、来源链接完整

## 5. 涉及文件清单

| 文件 | 改动类型 | 影响范围 |
|------|----------|----------|
| `src/lib/ai-news-renderer.ts` | 重写 | 核心渲染逻辑，~150 行改动 |
| `src/lib/ai-news-draft-flow.ts` | 修改 | Prompt + max_tokens + 解析，~30 行 |
| `src/lib/__tests__/ai-news-renderer.test.ts` | 适配 | 更新已有断言，新增 3 个测试用例 |
| `src/lib/ai-news-enrichment.ts` | **不改** | FactCard 结构已满足需求 |
| `src/lib/ai-news-run-flow.ts` | **不改** | 编排层逻辑不变 |
| `src/lib/ai-news-types.ts` | **不改** | 类型定义充分 |

## 6. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| FactCard 内容空洞（fallback 模式） | 中 | 提要显示保守回退文本 | 渲染时做 min-length 检查，不够时隐藏提要或降级为 bullet |
| Token 成本增加 | 高 | max_tokens 翻倍，日报每天一次影响可控 | 设置 `AI_NEWS_MAX_TOKENS` 环境变量可调节 |
| 日报长度大幅增加 | 高 | 用户阅读体验变化 | 保留「## 今日摘要」快速概览，长内容放后面 |
| 已有测试大量断言失败 | 中 | 需逐条更新测试 | Step 3 一次性更新所有断言 |

## 7. 回滚方案

如果生成效果不理想，可通过以下方式快速回退：
1. 将 `renderDailyAiNewsMarkdown` 用 Git revert 恢复
2. `max_tokens` 改回 `2400`
3. 下一次 cron 触发即生效
