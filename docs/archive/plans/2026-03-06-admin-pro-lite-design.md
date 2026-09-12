# 2026-03-06 Admin Pro Lite 重构设计（只出方案）

## 目标
- 在不引入 Ant Design / ProComponents 的前提下，重构后台结构为「简化版 Ant Design Pro」风格。
- 保留现有技术栈（Next.js App Router + Tailwind + 现有 UI 组件）。
- URL 与 API 合同不变，优先结构和体验升级。

## 决策记录
- 选型：仅借鉴信息架构和交互模式，不迁移到 Ant 组件体系。
- 路径：`Layout-First`（先后台壳层，后页面迁移）。
- 当前阶段：仅写设计，不执行实现。

## 一、目标架构（Layout-First）

### 1. 路由分层
保留现有后台路由：
- `/admin`
- `/admin/posts`
- `/admin/posts/[id]/edit`
- `/admin/comments`
- `/admin/categories`
- `/admin/tags`

新增后台专用结构层：
- `src/app/admin/layout.tsx`
- `src/components/admin/shell/AdminLayout.tsx`
- `src/components/admin/shell/AdminSider.tsx`
- `src/components/admin/shell/AdminHeader.tsx`
- `src/components/admin/shell/AdminBreadcrumbs.tsx`

### 2. 结构壳标准
- `Sider`：分组导航（总览 / 内容 / 互动 / 配置）
- `Header`：页标题、副标题、主操作入口
- `Breadcrumb`：路径层级（后台 / 模块 / 页面）
- `Content`：统一内容容器
- `PageHeader`：统一页头，替代各页重复头部实现

### 3. 组件层级抽象
- `admin/primitives`
  - `PageHeader`
  - `ActionBar`
  - `StatCard`
  - `StatusBadge`
- `admin/table`
  - 在现有 `DataTable` 基础扩展：加载态、空态、批量操作规范
- `admin/forms`
  - `EntityFormShell`（分类/标签复用）
- `admin/editor`
  - 编辑页右侧发布面板标准壳

### 4. 数据流策略
- 第一阶段继续使用 `fetch + useEffect`，避免一次性迁移风险。
- 统一页面状态：`loading / empty / error / ready`。
- 后续可二期考虑 Server Actions 渐进替换。

### 5. 视觉与密度策略
- 后台独立 token（间距、阴影、密度）但沿用现有主题变量体系。
- 左侧导航 + 顶栏固定，内容区滚动。
- 列表页高密度，编辑页高专注。

## 二、页面蓝图

### 1. `/admin` 仪表盘
- `PageHeader`（欢迎语 + 时间范围入口）
- KPI 卡片（文章、草稿、评论、用户）
- 快捷入口（文章/评论/分类/标签）
- 最近活动区（最近发布/最新评论）

### 2. `/admin/posts`
- 页头 + 主操作（新建文章）
- 搜索/筛选/批量动作条
- 统一数据表格：标题、作者、状态、统计、更新时间、操作
- 状态快捷筛选：全部/已发布/草稿

### 3. `/admin/posts/[id]/edit`
- 左侧主区：Markdown 编辑 + 实时预览
- 右侧副区：发布面板（状态、slug、封面、摘要、检查项）
- 顶部固定操作条：保存、预览、返回

### 4. `/admin/comments`
- 搜索 + 文章筛选 + 时间筛选
- 评论治理表格：内容摘要、作者、文章、时间、操作
- 批量治理操作入口（删除、后续可扩展审核状态）

### 5. `/admin/categories` & `/admin/tags`
- 统一 `EntityFormShell`
- 统一列表+表单交互模式
- 分类字段：名称/slug/描述
- 标签字段：名称/slug/颜色

### 6. 全局后台导航
- 分组：
  - 总览：仪表盘
  - 内容：文章管理
  - 互动：评论管理
  - 配置：分类管理、标签管理
- 底部：返回站点、账号入口、退出

## 三、实施分期（规划）

### Phase 1（底盘，1-2 天）
- 搭建 `AdminLayout` 壳层并接入全部 `/admin/*` 页面
- 仅替换结构，不改业务逻辑

### Phase 2（列表体系，2-3 天）
- 标准化 `PageHeader + ActionBar + DataTable`
- 优先改造 `/admin/posts`，再复用至 `/admin/comments`

### Phase 3（配置页统一，1-2 天）
- 抽象 `EntityFormShell`，统一分类和标签页

### Phase 4（编辑工作台，1-2 天）
- 标准化编辑页顶部操作条 + 右侧发布面板

### Phase 5（收尾，1 天）
- 统一样式密度与 token，补齐测试与文档

## 四、风险与约束
- 不改 URL 与 API 契约，降低迁移风险。
- 先壳后业务，阶段可回滚。
- 不引入外部 UI 体系，避免双设计系统并存。

## 五、验收指标
- 结构一致性：后台页统一 Header/Breadcrumb/Content 模式。
- 可维护性：重复页面结构显著减少。
- 操作效率：高频动作在 1-2 次点击可达。
- 稳定性：现有核心测试不回归。

## 六、后续动作（未执行）
- 若进入实现：基于本设计生成 implementation plan（任务级别、测试级别、回归清单）。
