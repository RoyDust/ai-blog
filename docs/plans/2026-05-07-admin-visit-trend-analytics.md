# 后台访问趋势数据处理与展示计划

## 背景

当前后台首页 `src/app/admin/page.tsx` 已有「访问趋势」面板，但使用的是 `STATIC_VISIT_TREND` 静态示意数据，不能反映真实访问情况。项目现有 `Post.viewCount` 字段只能表示文章累计浏览量，不支持按日期展示趋势、PV/UV 或来源分析。

## 目标

- 记录前台页面访问数据。
- 后台首页展示真实访问趋势，替换静态示意数据。
- 支持最近 7 / 30 / 90 天切换。
- 统计 PV、UV、今日 PV、昨日 PV、热门文章访问量。
- 文章页访问时同步累加 `Post.viewCount`。

## 推荐方案

第一阶段采用「访问日志表 + 实时聚合查询」：

- 新增 `VisitLog` 表保存原始访问记录。
- 前台通过客户端埋点调用 `/api/analytics/visit`。
- 后台首页直接从 `VisitLog` 按日期聚合生成趋势数据。
- 访问量增长后，再引入每日聚合表 `VisitDailyStat` 优化查询性能。

该方案改动小、上线快，并且保留后续扩展空间。

## 数据模型设计

### 第一阶段新增模型

```prisma
model VisitLog {
  id        String   @id @default(cuid())

  path      String
  postId    String?
  referrer  String?
  userAgent String?
  ipHash    String?
  visitorId String?

  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([path])
  @@index([postId])
  @@index([visitorId])
  @@map("visit_logs")
}
```

### 后续可选聚合模型

```prisma
model VisitDailyStat {
  id        String   @id @default(cuid())

  date      DateTime
  path      String?
  postId    String?

  pv        Int      @default(0)
  uv        Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([date, path, postId])
  @@index([date])
  @@index([postId])
  @@map("visit_daily_stats")
}
```

## 访问采集设计

新增客户端埋点组件：

```txt
src/components/analytics/VisitTracker.tsx
```

职责：

- 监听当前 pathname。
- 从 `localStorage` 获取或生成匿名 `visitorId`。
- 调用 `/api/analytics/visit` 上报访问。
- 跳过后台、API、登录、注册等不需要统计的路径。

建议只挂载在前台 layout：

```txt
src/app/(public)/layout.tsx
```

避免后台访问污染统计数据。

## API 设计

### 访问上报 API

新增：

```txt
src/app/api/analytics/visit/route.ts
```

请求：

```json
{
  "path": "/posts/example-slug",
  "referrer": "https://example.com",
  "visitorId": "anonymous-client-id"
}
```

处理逻辑：

1. 校验 `path`。
2. 过滤 `/admin`、`/api`、`/login`、`/register` 等路径。
3. 读取 `user-agent` 与 IP，并对 IP 做 hash。
4. 如果是 `/posts/[slug]`，查询对应文章。
5. 写入 `VisitLog`。
6. 如果命中文章，同步更新 `Post.viewCount + 1`。
7. 返回 `{ ok: true }`。

### 后台趋势 API，可选

新增：

```txt
src/app/api/admin/analytics/trend/route.ts
```

请求：

```txt
GET /api/admin/analytics/trend?range=7
GET /api/admin/analytics/trend?range=30
GET /api/admin/analytics/trend?range=90
```

返回：

```ts
{
  range: number;
  summary: {
    totalPv: number;
    totalUv: number;
    todayPv: number;
    yesterdayPv: number;
  };
  trend: Array<{
    date: string;
    label: string;
    pv: number;
    uv: number;
  }>;
}
```

第一版也可以不单独创建后台 API，直接在 `src/app/admin/page.tsx` 里服务端查询 Prisma。

## 后台页面改造

修改：

```txt
src/app/admin/page.tsx
```

主要改动：

- 删除 `STATIC_VISIT_TREND`。
- 新增 `getVisitTrend(range)` 服务端查询函数。
- `VisitTrendPanel` 改为接收真实数据：

```ts
function VisitTrendPanel({
  trend,
  range,
  summary,
}: {
  trend: VisitTrendItem[];
  range: 7 | 30 | 90;
  summary: VisitTrendSummary;
})
```

- 将「静态示意」标识替换为真实统计指标。
- 通过链接支持区间切换：

```tsx
<Link href="/admin?range=7">7 天</Link>
<Link href="/admin?range=30">30 天</Link>
<Link href="/admin?range=90">90 天</Link>
```

## 统计口径

- PV：每次有效页面访问计 1 次。
- UV：同一天相同 `visitorId` 计 1 次；无 `visitorId` 时可用 `ipHash + userAgent` 降级。
- 文章访问：路径匹配 `/posts/[slug]` 时关联文章并累加 `Post.viewCount`。
- 排除路径：`/admin`、`/api`、`/login`、`/register`、`/profile`、`/write`。

## 实施步骤

### Phase 1：最小可用版

1. 修改 `prisma/schema.prisma`，新增 `VisitLog`。
2. 执行迁移与生成客户端：

```bash
pnpm prisma migrate dev --name add_visit_analytics
pnpm prisma generate
```

3. 新增 `src/app/api/analytics/visit/route.ts`。
4. 新增 `src/components/analytics/VisitTracker.tsx`。
5. 在 `src/app/(public)/layout.tsx` 接入 `VisitTracker`。
6. 修改 `src/app/admin/page.tsx`，用真实趋势数据替代静态数据。
7. 支持 7 / 30 / 90 天切换。
8. 手动验证访问记录和后台图表。

### Phase 2：增强统计版

1. 增加 UV、今日 PV、昨日 PV、近 7 日 PV 概览。
2. 增加热门路径、热门文章、来源 referrer 排行。
3. 增加后台趋势 API，供客户端组件动态切换。
4. 为 API 和聚合逻辑补充单元测试。

### Phase 3：性能优化版

1. 新增 `VisitDailyStat` 聚合表。
2. 新增聚合脚本或定时任务。
3. 后台优先读取聚合表。
4. 对历史 `VisitLog` 做归档或清理策略。

## 测试与验收

### 手动验证

- 访问首页后，`visit_logs` 表新增记录。
- 访问文章页后，`visit_logs.postId` 有值，且 `posts.viewCount` 增加。
- 访问 `/admin`、`/api` 不产生统计记录。
- 后台首页趋势图不再显示静态数据。
- 切换 7 / 30 / 90 天后，图表数据范围正确。

### 自动化测试建议

- `/api/analytics/visit` 正常写入访问日志。
- 无效 path 被拒绝。
- 排除路径不会写入日志。
- 文章路径能正确关联 post 并增加 viewCount。
- 后台趋势聚合能补齐无访问日期为 0。

## 风险与注意事项

- 不要直接保存明文 IP，建议保存 hash。
- 埋点组件应只在前台启用，避免后台管理行为污染统计。
- PV 写入频率较高，后期需要聚合表或限流策略。
- UV 依赖浏览器本地 `visitorId`，清理浏览器数据后会重新计数。
- Next.js App Router 下服务端页面需要注意 `searchParams` 类型和动态渲染。

## 结论

优先实现 `VisitLog + 实时聚合`，可以快速让后台访问趋势从静态示意变成真实数据。等访问量增加后，再引入 `VisitDailyStat` 做性能优化。