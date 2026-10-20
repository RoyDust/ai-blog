# 前台重设计 · 第一阶段（修订）：保留现有布局的首页三方案

- 日期：2026-10-20
- 状态：待选定方案（选定后进入第二阶段，按批次设计其余前台页面）
- 范围：仅设计产物，不含任何应用代码改动
- 背景：`01-homepage-proposals.md` 的 A / B / C 三案被否决，原因是「对原本布局破坏太多」。本文三案 D / E / F 全部保留现有首页骨架，只在骨架内做优化，差异在「改到哪一层」。
- 线框图：已在会话中用 visualize 渲染（每案桌面端 + 移动端各一份，圆点编号对应本文改动清单），未落盘。

## 1. 不动的骨架（三案共同）

| 层 | 现状 | 三案处理 |
|---|---|---|
| 导航 | 浮动胶囊 `.reader-nav`，滚动隐藏，lg+ 内联搜索，sm+ HuePicker / ThemeToggle，md- 汉堡菜单 | 不动 |
| 背景 | 背景图从顶部淡入页面，首页 `--reader-background-height: 46vh`，`::after` 网格纹理 | 只调高度与亮色叠色 |
| 栅格 | `--page-width clamp(61.5rem, 62vw, 76rem)`，xl 以上左 rail `--rail-width` + 主列 | 不动，rail 仍只在 xl 出现 |
| 主列顺序 | Hero 卡 → AI 日报面板 → 最新文章列表 | 顺序不动；E / F 在其后追加面板 |
| rail | 资料（浮动面板）→ 分类 → 标签 → 热门 → 阅读统计（登录态） | D / F 不动；E 调序 |
| 页脚 | `.reader-panel`，站名 kicker + 描述 + 入口 chips | 不动 |
| 主题 | OKLCH + `--hue` 参数化，暗色默认 | 保留，只改 token 值 |
| 字体 | AlibabaPuHuiTi-3-65（500）+ Noto Serif SC 700/900（`.serif-display-scope` 内 h1 / `.font-display`） | 保留，补一档真粗体 |
| 圆角 / 阴影 / blur | `--radius-panel 1rem`、`--radius-card 1.5rem`、`--reader-shadow-normal / hover`、面板 blur | 全部沿用 |
| 数据与缓存 | `revalidate = 300`；`/` 在 `PUBLIC_LIST_PATHS` 中 | 不动；E / F 新增的查询并入现有 `Promise.allSettled` |

共同约束同 `01` 第 2 节：公共 layout 不读 session，不新增 `(public)/loading.tsx`，登录态内容不进首页，正文 ≥ 15px、行高 ≥ 1.65、触控 ≥ 44px、`prefers-reduced-motion` 下关位移动画。

## 2. 方案 D 「原版精修」：不加区块，不加查询

### 定位
把现有首页当成已定稿的版面，只修层级、对比度和节奏。一个读者打开首页看到的东西和现在一样，但第一眼落在精选文章标题而不是站名上，亮色模式不再发灰，列表更易扫读。

### 改动清单（编号对应线框圆点）

1. **Hero 层级反转。** 站名 h1 从 `clamp(2.25rem, 5vw, 3.5rem)` 缩到 `clamp(1.5rem, 2.6vw, 2rem)`，作报头；精选文章标题从 `text-lg/xl` 升为 `clamp(1.5rem, 2.8vw, 2.125rem)`、衬线 700、行高 1.25、`line-clamp-2`；站点描述 `line-clamp-2`（现为 3）；CTA 文案「阅读精选」改「阅读全文」，下方补一行 meta（分类 · 日期 · 分钟，需在 `page.tsx` 把这几个字段传入 Hero）。封面区固定 4:3，md 以上与文字区等高。
2. **AI 日报面板。** `md:grid-cols-5` 改为 `md:grid-cols-[1.6fr_repeat(4,1fr)]`；首条字号 0.9375rem，md 以上多一行 excerpt（`line-clamp-1`）；移动端横滑卡 `min-w-[82%]` 改 `min-w-[72%]`，露出下一张；空态不再 `return null`，保留面板并显示「今日日报生成中」。
3. **最新文章列表。** 缩略图 `h-24 / h-28` 改固定 4:3（7rem / 9rem 宽）；标题 1.0625rem、行高 1.45；摘要从 `md:block` 改 `sm:block`；meta 0.75rem；区块标题去掉 `--plain`，与日报统一为带竖条样式。
4. **真粗体。** `public/font/` 新增 AlibabaPuHuiTi-3-85-Bold（woff2 优先），`fonts.ts` 注册 weight 700。现状 `.reader-shell :where(h1…h6, .font-display) { font-synthesis: none }` 加上只有 500 一档，所有无衬线标题的 `font-bold` 实际按 500 渲染，这是层级发虚的根因；chips 等非标题元素则是浏览器合成的假粗体。
5. **亮色模式。** 首页 `--reader-background-height` 46vh → 34vh；亮色下背景图上叠一层 `--reader-background-tint`（见 token 表）并降饱和；卡片底色提亮、正文加深。暗色只把高度收到 42vh。
6. **节奏与可达。** 区块间距改用 `--section-gap`（1.75rem，sm 2.25rem）；所有可点元素 `focus-visible` 2px `--accent-sky` 外框 + 2px 偏移；日报条目最小高 44px；rail 面板标题统一 0.95rem，热门加等宽序号。

### 排版（三案共用）

| 元素 | 字号 / 行高 | 字体 |
|---|---|---|
| 站名报头 | clamp(1.5rem, 2.6vw, 2rem) / 1.1 | Noto Serif SC 700 |
| 精选标题 | clamp(1.5rem, 2.8vw, 2.125rem) / 1.25 | Noto Serif SC 700 |
| 区块标题 | 1.125rem / 1.3 | AlibabaPuHuiTi 700（需第 4 条） |
| 列表标题 | 1.0625rem / 1.45 | AlibabaPuHuiTi 500 |
| 摘要正文 | 0.9375rem / 1.7 | AlibabaPuHuiTi 500 |
| 日报条目 | 0.875rem / 1.5 | AlibabaPuHuiTi 500 |
| meta / kicker | 0.75rem，tabular-nums | AlibabaPuHuiTi 500 |

### token 调整（三案共用；名称不变，只改值）

| token | 亮色现值 | 亮色新值 | 暗色现值 | 暗色新值 |
|---|---|---|---|---|
| `--card-bg` | oklch(0.985 0.008 h) | oklch(0.995 0.006 h) | oklch(0.17 0.022 h) | 不变 |
| `--text-body` | oklch(0.37 0.018 h) | oklch(0.33 0.018 h) | oklch(0.78 0.018 h) | 不变 |
| `--text-faint` | oklch(0.48 0.014 h) | oklch(0.45 0.014 h) | oklch(0.52 0.018 h) | oklch(0.58 0.018 h) |
| `--reader-border` | 前景 6% | 前景 8% | rgb(128 163 205 / 0.22) | rgb(128 163 205 / 0.26) |
| `--reader-background-height`（首页） | 46vh | 34vh | 46vh | 42vh |
| `--reader-background-tint`（新增） | 无 | color-mix(in oklab, var(--page-bg) 55%, transparent) | 无 | 不用 |

### 交互
导航、搜索、主题切换、HuePicker 不动。卡片 hover 保持上浮 2px；最新文章条目 hover 底色保持。移动端无结构变化：Hero 文上图下，封面高 12rem；日报横滑；列表缩略图 6.5rem。

### 权衡
- 零结构风险，不新增查询，ISR 不变。工作量 **S**。
- 移动端和平板仍然没有分类、热门、系列入口；首页信息量不变。

## 3. 方案 E 「发现层下沉」：D + 把「发现」补齐到所有断点

### 定位
现状最大的缺口是 rail 只在 xl 出现，xl 以下的读者看不到分类、热门、系列。E 在 D 的基础上，把这些「发现」内容在 rail 不可见时下沉到主列，并把日报做成「今日 + 往期」。

### 改动清单（1–6 同 D）

7. **rail 调序。** 资料 → 热门 → 分类 → 标签，阅读导向优先；标签限 10 个 + 「全部标签」。
8. **日报面板分栏。** `md:grid-cols-[2fr_3fr]`：左侧今日（日期 kicker、标题 0.9375rem、excerpt `line-clamp-3`、「阅读今日日报」链接），右侧往期 4 条单行（日期等宽 + 标题 `line-clamp-1`）。移动端今日卡在上、往期列表在下，不再横滑。
9. **新增「系列与专题」双栏面板**，位于最新文章之后：系列 3 条（名称、篇数、最新一篇标题）与专题指南 2 条（标题、一句描述、「全部指南」）。
10. **新增「发现」区**，`xl:hidden`，位于系列与专题之后：分类 chips 6 个（带篇数）、热门 3 条（等宽序号）、「全部标签」入口。server 直出，不走 SWR。
11. **Newsletter 面板**，页脚之前、所有断点：一句文案、邮箱输入、订阅按钮、RSS 链接，复用 `components/blog/NewsletterForm.tsx`。

### 数据与缓存
- 首页新增 4 个 server 查询并入现有 `Promise.allSettled`：`getCategoryDirectory()`、热门（`viewCount desc`，与 `/api/posts/popular` 同口径）、系列（与 `(public)/series/page.tsx` 内 `getPublicSeries` 同口径，建议抽到 `lib`）、`listPublicTopicGuides()`。
- 均在 300s ISR 内。`/` 已在失效路径中；系列写路径（`api/admin/series`）已调用 `revalidatePublicContent`；**专题指南写路径未见 revalidate 调用，实现时需补**。
- 任一查询失败只隐藏对应面板，不影响其余区块（沿用现有 `allSettled` 处理）。

### 权衡
- 补上移动端最大的缺口；日报可读性明显提升；首页出现系列、指南、订阅入口。
- 新增 3 个 server 组件（系列与专题、发现区、Newsletter 面板）；xl 的 rail（SWR）与非 xl 的发现区（server）是两套渲染，要保证排序与截断一致；桌面页面约长 40%。工作量 **M**。

## 4. 方案 F 「主流加深」：D + 把主列阅读流做厚

### 定位
保持 rail 不动，把主列从「1 篇精选 + 5 条日报 + 4 条最新」加厚为「1 + 2 精选、今日 + 往期日报、2 大 + 6 紧凑最新、系列更新、订阅」。适合文章产量稳定、希望首页像一期刊物的节奏。

### 改动清单（1–6 同 D）

7. **精选行。** Hero 卡下方一行两张横向小卡（封面 5rem、「精选 · 分类」kicker、标题 `line-clamp-2`、分钟）。来源 `getFeaturedPosts(3)`；Hero 用第 1 篇，小卡用第 2、3 篇；featured 不足 3 篇时整行隐藏，Hero 退回 `getHomeLatestPosts` 第 1 条（现状行为）。
8. **日报面板分栏。** 同 E 第 8 条。
9. **最新文章 5 条改 8 条，两种密度。** 前 2 条「大条目」（封面 10rem、摘要 `line-clamp-2`、标签 2 个），后 6 条沿用紧凑样式。来源 `getHomeLatestPosts(8 + 3)` 后对 Hero 与精选行已出现的文章去重再取 8。
10. **「系列更新」横条。** 最近有更新的 3 个系列，每张卡：名称、篇数、最新一篇标题与日期；移动端横滑。来源系列查询按最新文章时间排序（现有 `getPublicSeries` 需加排序）。
11. **Newsletter 面板。** 同 E 第 11 条。

### 数据与缓存
- 新增 `getFeaturedPosts(3)` 与系列 2 个查询，首页共 4 个；ISR 同上。
- 注意 `getHomeLatestPosts` 的排序已是 `generatedByAiNews asc → featured desc → createdAt desc`，Hero 现状本来就是「第一篇精选」，F 只是把第 2、3 篇也露出来。

### 权衡
- 首屏之下的阅读选择最多，featured 字段真正被用上，页面「内容感」最强。
- 移动端仍没有分类、热门入口（rail 仍只在 xl）；去重与 featured 不足的兜底需要测试覆盖；桌面页面约长 60%。工作量 **M**。

## 5. 自评

- **D** 做的全是「本来就该这样」的修正，没有任何需要讨论的产品决定，但也不解决移动端缺入口的问题。
- **E** 的「发现」区与 rail 内容重复，是刻意为之（两者永不同时出现）；真正的成本在于两套渲染的一致性，建议把 rail 也改为 server 直出 + 客户端只负责登录态的阅读统计，这样两处共用一份数据，但这已经碰到 Sidebar 的重构，属于第二阶段再议。
- **F** 对内容产量有要求：featured 常年不足 3 篇时精选行永远不出现，「系列更新」也会长期是同三个系列。现状 featured 文章数量未核实。
- 三案都依赖第 4 条「真粗体」；若不加字重文件，区块标题的层级改善会打折。
- 线框中系列篇数、专题指南标题为示意值。

## 6. 对比

| 维度 | D 原版精修 | E 发现层下沉 | F 主流加深 |
|---|---|---|---|
| 定位 | 修层级、对比、节奏 | 补齐移动端发现入口 | 加厚主列阅读流 |
| 信息密度 | 与现状相同 | 中（+系列、指南、发现、订阅） | 高（+精选 2、最新 +4、系列、订阅） |
| 视觉风格 | 与现状相同，更清晰 | 与现状相同，面板略多 | 与现状相同，列表感更强 |
| 移动端表现 | 同现状，仍无分类 / 热门入口 | 最好：发现区补位，日报不横滑 | 页面最长，仍无分类 / 热门入口 |
| 实现成本 | S：改 3 个组件 + token + 字体 | M：D + 3 个新 server 组件 + 4 查询 | M：D + 精选行 / 大条目 / 系列条 + 去重逻辑 |
| 适合的内容节奏 | 任意 | 文章总量大、分类 / 系列已成体系 | 周更以上、featured 维护到位 |

## 7. 推荐

推荐 **E**。理由：D 的全部内容都包含在 E 里；现状最明显的体验缺口是 xl 以下看不到任何发现入口，而站点分类、系列、指南的数据已经成体系；E 新增的都是 server 直出面板，不触碰 rail 的 SWR 逻辑，可以分两步落地（先 D 的 1–6 条，再 7–11 条）。F 对 featured 维护的依赖较重，在确认精选文章稳定供给前不建议先做。

## 8. 第二阶段批次预案（选定后执行）

- 批次 1：文章列表（/posts）、文章详情（目录 / 阅读进度 / 评论区 / 相关推荐）、分类 / 标签 / 系列页
- 批次 2：搜索、归档、专题指南
- 批次 3：关于 / 联系、登录 / 注册

每批先给线框 + 规格，确认后再做下一批；第三阶段实现需用户明确说「开始实现」。
