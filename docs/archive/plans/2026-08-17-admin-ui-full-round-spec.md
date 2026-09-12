# Spec: 后台 UI/交互/动效全量修复（P0–P3）

## Problem Statement

运营者每天在后台完成发布、审核、AI 流水线等高频任务，但当前后台存在多处信任裂缝：发布（最高风险动作）一键上线、无确认、无撤销，防护比删除还少；组件词汇分裂（两套分页、两套对话框、两种 loading、同控件不同圆角）；暗色模式下硬编码浅色徽标刺眼；危险运维动作（清理接口日志、重新生成今日日报）无确认且失败被静默吞掉；动效只有噪音（呼吸圆点、hover 位移/放大、发光投影）没有状态反馈。设计评审总分 25/40，处于"可用但不可信"区间。

## Solution

后台 P0–P3 全量一轮修复，交付一个可信、一致、暗色完整、动效克制的运营后台：发布确认统一走应用内 AlertDialog（仅"发布"方向，转草稿保持一键）；统一组件词汇与语义色 token；危险运维动作加确认与成功/失败 toast；补齐键盘与读屏无障碍；删除装饰性动效、保留状态反馈；后台文案统一中文。全程不新增依赖、不改 API 契约、不动公共前台。

## User Stories

1. 作为运营者，我想在点击"发布"后看到确认弹窗（说明发布后立即对读者可见），以便避免误触上线造成事故。
2. 作为运营者，我想批量发布时弹窗展示篇数与影响，以便批量操作前有把控。
3. 作为运营者，我想"转草稿"保持一键切换，以便日常下架不被确认弹窗打断。
4. 作为编辑器用户，我想格式按钮（加粗/标题/引用等）在光标处插入 Markdown 标记，以便不打断写作流、不再在文末冒出标记。
5. 作为运营者，我想清理接口日志前有确认、完成后有成功/失败 toast，以便确认操作已生效。
6. 作为运营者，我想重新生成今日日报前有覆盖确认，以便不会误覆盖当天内容。
7. 作为管理员，我想解绑 GitHub 与归档封面使用与删除一致的应用内确认弹窗，以便操作体验一致、键盘可用。
8. 作为暗色模式用户，我想状态徽标/错误盒/成功数字在暗色下可读不刺眼，以便暗色下完成完整运营流程。
9. 作为键盘用户，我想设置页标签可用方向键与 Home/End 切换，以便不依赖鼠标。
10. 作为读屏用户，我想表格行复选框播报"选择第 N 行"而非原始 UUID，以便知道选中了什么。
11. 作为读屏用户，我想面包屑是可导航的链接，以便理解层级并跳转。
12. 作为运营者，我想列表空态有图标与下一步指引，以便知道该做什么而不是面对一行灰字。
13. 作为运营者，我想 AI 任务页轮询从 3 秒降到 10 秒且刷新去抖，以便页面不抖动、接口操作日志不被刷屏。
14. 作为运营者，我想 AI 批量补全的"自动应用"默认关闭，以便避免 AI 输出未经人工确认直接写入。
15. 作为运营者，我想批量 AI 补全弹窗字段按用途分组，以便配置时认知负担降低。
16. 作为运营者，我想后台动效只传达状态（按钮忙碌、toast、弹层出现），以便任务操作不被装饰打断。
17. 作为运营者，我想后台不再有呼吸圆点、hover 位移/放大、发光投影与彩色长阴影等装饰动效，以便界面安静可信。
18. 作为运营者，我想后台文案统一中文（不再出现 PAGE/rows/Danger Zone/Structure/Account 等英文残留），以便界面语言一致。
19. 作为运营者，我想帮助提示是真实可用信息（如 Ctrl+K 全局搜索），以便不被假链接误导。
20. 作为运营者，我想后台辅助小字（10px）提升到可读字号，以便不费力辨认。
21. 作为读屏用户，我想通知未读圆点可被播报，以便知道有新通知。
22. 作为运营者，我想仪表盘不再显示伪造的"运行正常"绿点，以便只相信真实状态。
23. 作为测试/QA，我想发布确认、purge 确认、tablist 键盘、编辑器光标插入等行为有自动化回归测试，以便后续改动不破坏这些关键交互。

## Implementation Decisions

1. 新增通用 ConfirmDialog 组件（基于既有 AlertDialog 封装，支持 title/description/confirmLabel/cancelLabel/tone/submitting/impacts），统一承载五类确认场景：发布、清理日志、重生成日报、解绑 GitHub、归档封面。
2. 发布确认仅拦截"发布"方向：行级发布、批量发布、编辑器发布提交（intent=publish）弹窗；"转草稿"方向保持一键切换（仅 toast 反馈），不弹窗。批量发布弹窗展示受影响篇数，>5 篇突出提示。
3. 分页收敛：统一使用既有 AdminPagination 组件（客户端 onPageChange 路径），删除文章工作台侧的重复分页实现与重复的页码工具函数；翻页不再整页刷新、保留 SWR 缓存。
4. 轮询策略：AI 任务活跃轮询 refreshInterval 3s → 10s，路由刷新去抖，仅在任务状态可能变化时触发。
5. 语义色收敛：所有状态色（badge、通知 severity、搜索图标底色、日志成功/失败数字、错误/成功盒）迁移到既有 CSS 语义 token（success/warning/danger）；后台专属主题覆盖 --text-faint 为 #64748b（亮色达 WCAG AA），不影响公共前台。
6. 危险运维动作反馈：清理日志与重生成日报加确认弹窗；清理日志成功/失败分别 toast，移除静默吞错路径。
7. 批量 AI 补全"自动应用"默认关闭（需人工勾选）。
8. 无障碍补齐：设置页 tablist 实现 roving tabindex + 左右方向键 + Home/End；面包屑末级外渲染为链接；表格行复选框 aria-label 使用行序号；列表 loading/空态补 role="status"；后台 10px 提示字号提升为 12px；通知未读圆点加 role="img"。
9. 空态教学化：DataTable 增加可选 emptyState，默认 Empty（图标+文案），文章任务/日志等列表空态统一教学化。
10. 动效：删除装饰性动效（激活标签呼吸圆点、列表 hover 位移、图标 hover 放大、侧栏发光投影、筛选栏彩色长阴影、34px 装饰阴影）；移除 WorkspacePanel 死参数 reveal；保留 Radix 弹层 fade/zoom 与全局 prefers-reduced-motion 兜底。
11. 文案统一：eyebrow 英文改中文或移除；PAGE/rows/Danger Zone/AI OPS 等改中文；页脚伪帮助链接改为真实可用提示（Ctrl+K）。
12. 细节修复：Modal 无标题时不再兜底 sr-only"弹窗"（改可选 ariaLabel）；仪表盘缩略图占位渐变改语义 token；评论统计卡无 hint 时不再渲染"运行正常"绿点。

## Testing Decisions

1. 测试缝（单一）：既有 Vitest 组件/集成测试层（Testing Library + user-event + SWR/fetch mock）。现有 Playwright e2e 仅覆盖登录重定向且未建立管理端认证流，不为本轮引入新 e2e 缝。
2. 好测试的标准：只断言外部行为（点击按钮→弹窗出现→确认→发出正确 API 请求；取消→不请求；方向键→激活标签变化；光标处插入→文本出现在正确位置），不 mock 组件内部实现细节。
3. 被测模块：ConfirmDialog（渲染/回调/提交态）；发布确认流程（行级发布、批量发布、编辑器发布：弹窗→确认调 API、取消不调；转草稿方向不弹窗直接调 API）；purge 确认与失败 toast；设置 tablist 键盘导航；MarkdownEditor 选区插入与焦点恢复；DataTable emptyState 与行复选框 aria-label；分页收敛后的 PostsTable；语义色 badge 渲染。
4. 先例：ApiOperationLogsClient.test.tsx、taxonomy-studio.test.tsx、posts-workbench.test.tsx、editor-publish-flow.test.tsx、AdminPagination.test.tsx、DataTable.test.tsx。

## Out of Scope

- 不改数据模型与 API 契约（无 schema/接口变更）。
- 不重构编辑器内核（Markdown 解析、渲染管线）。
- 不做路由级重排与页面布局重构。
- 不动公共前台视觉（--text-faint 仅在后台主题覆盖）。
- 不改全局滚动条样式（后台与前台一致的既定决策）。
- 不做发布撤销（undo toast）替代方案，本轮确认为 AlertDialog 弹窗。
- SSE/WebSocket 替代 AI 任务轮询，记为后续优化项。

## Further Notes

- 依据设计评审快照 .impeccable/critique/src-app-admin.md（25/40，P0×1 / P1×3 / P2×4）。
- 按 Phase 实施与验证：A 基础设施 → B P0 发布确认 → C P1 一致性 → D P2 反馈/a11y/空态 → E 动效 → F 文案 → G 测试全量（pnpm test → lint → build），每 Phase 跑对应单测后进入下一 Phase，按 Phase 粒度保留回滚。
- 已确认的用户决策：发布仅"发布"方向弹 AlertDialog；转草稿保持一键。
- 实施计划详见 docs/plans/2026-08-17-admin-ui-full-round.md。