# 计划：文章精选字段（featured）全栈实现

## 目标

为 Post 模型新增 `featured` 布尔字段。后台管理员可标注文章为精选；前台首页取前 3 篇精选文章填充 HomeFeaturedGrid；文章列表页精选文章置顶并带标注。

---

## Phase 0：已确认的现有模式（勿跳过）

### 数据库
- `prisma/schema.prisma` Post 模型现有布尔字段：`published Boolean @default(false)`（第 88 行）
- 新字段照此模式：`featured Boolean @default(false)`
- 现有索引：`@@index([published, createdAt])`，需新增 `@@index([featured, createdAt])`

### 后端验证层
- `src/lib/validation.ts` `parsePostPatchInput` 返回对象（约第 263 行）：
  ```ts
  published: data.published == null ? undefined : readBoolean(data.published, 'published'),
  ```
  照此模式添加 `featured`。

### 后端更新函数
- `src/lib/ai-authoring.ts` `updateAdminPost`（约第 466 行）`prisma.post.update` 的 `data` 对象：
  ```ts
  published: input.published,
  publishedAt: input.published ? new Date() : null,
  ```
  照此模式添加 `featured: input.featured`。

### 数据查询层
- `src/lib/posts.ts` `getPublicPostSelect()`（第 39 行）：返回 `id, title, slug, excerpt, coverImage, createdAt, viewCount, author, category, tags, _count`。需加 `featured: true`。
- `PUBLIC_POST_ORDER_BY`（第 37 行）：`[{ createdAt: 'desc' }, { id: 'desc' }]`。
- `getPublishedPostsPage()`（第 83 行）：`where` 对象现为 `{ published: true, deletedAt: null }`。

### 前台首页
- `src/app/(public)/page.tsx` 第 57–59 行：按位置切片，`posts[0]` 为 lead，`posts[1-2]` 为 secondary。需改为按 `featured` 字段筛选。

### 文章列表
- `src/components/blog/PostsListingClient.tsx`：`posts[0]` → `PostCardFeatured`，其余 → `PostCard`。需改为：精选文章用 `PostCardFeatured` + 精选标注，非精选文章全部用 `PostCard`。

### 后台编辑 UI
- `src/app/admin/posts/[id]/edit/page.tsx` 第 309–340 行："文章状态" WorkspacePanel，含 `published` 双按钮切换。照此模式新增"精选状态" panel。
- `formData` state（第 47 行）：`{ title, slug, content, excerpt, coverImage, categoryId, tagIds, published }`。需加 `featured: false`。

---

## Phase 1：数据库 Schema

**文件：** `prisma/schema.prisma`

### 任务

1. 在 Post 模型 `published` 字段下方添加：
   ```prisma
   featured    Boolean   @default(false)
   ```

2. 在 `@@index([published, createdAt])` 下方添加：
   ```prisma
   @@index([featured, createdAt])
   ```

3. 运行迁移：
   ```bash
   pnpm prisma db push
   pnpm prisma generate
   ```

### 验证
- `prisma/schema.prisma` 中能 grep 到 `featured`
- `pnpm prisma generate` 无报错
- Prisma Client 类型中 `Post.featured` 为 `boolean`

---

## Phase 2：后端数据层

### 2-A `src/lib/validation.ts`

在 `parsePostPatchInput` 返回对象的 `published` 行下方添加：
```ts
featured: data.featured == null ? undefined : readBoolean(data.featured, 'featured'),
```

同时在该函数的 TypeScript 返回类型（`AdminPostPatchInput`）中加入 `featured?: boolean`。

### 2-B `src/lib/ai-authoring.ts`

在 `updateAdminPost` 的 `prisma.post.update` `data` 对象中，`published` 行下方添加：
```ts
featured: input.featured,
```

在同函数的 `select` 对象中加入 `featured: true`。

### 2-C `src/lib/posts.ts`

1. `getPublicPostSelect()` 返回对象加入 `featured: true`。

2. `PublicPostRecord` interface 加入 `featured: boolean`。

3. 新增专用查询函数（在 `getPublishedPostsPage` 之前）：
   ```ts
   export async function getFeaturedPosts(limit = 3) {
     return prisma.post.findMany({
       where: { published: true, featured: true, deletedAt: null },
       select: getPublicPostSelect(),
       orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
       take: limit,
     })
   }
   ```

4. `getPublishedPostsPage` 的 `orderBy` 改为精选置顶：
   ```ts
   orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
   ```

### 2-D `src/app/api/admin/posts/[id]/route.ts`

GET handler 的 `select` 对象加入 `featured: true`。

### 验证
- grep `featured` 能在上述 4 个文件中找到
- `pnpm tsc --noEmit` 无类型错误

---

## Phase 3：后台管理 UI

**文件：** `src/app/admin/posts/[id]/edit/page.tsx`

### 3-A formData state（第 47 行）

```ts
const [formData, setFormData] = useState({
  // ...现有字段...
  published: false,
  featured: false,   // 新增
})
```

### 3-B 数据加载（GET 响应填充 formData）

在设置 `published: data.published` 的地方同步加入：
```ts
featured: data.featured ?? false,
```

### 3-C 新增"精选状态" WorkspacePanel

照"文章状态" panel（第 309–340 行）的模式，在其下方新增：

```tsx
<WorkspacePanel title="精选状态" description="精选文章会出现在首页和文章列表顶部。">
  <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)]">当前状态</p>
        <p className="text-sm text-[var(--muted)]">最多 3 篇精选文章会展示在前台。</p>
      </div>
      <StatusBadge tone={formData.featured ? "success" : "neutral"}>
        {formData.featured ? "精选" : "普通"}
      </StatusBadge>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        size="sm"
        variant={formData.featured ? "outline" : "primary"}
        disabled={!formData.featured}
        onClick={() => setFormData((prev) => ({ ...prev, featured: false }))}
      >
        取消精选
      </Button>
      <Button
        type="button"
        size="sm"
        variant={formData.featured ? "primary" : "outline"}
        disabled={formData.featured}
        onClick={() => setFormData((prev) => ({ ...prev, featured: true }))}
      >
        设为精选
      </Button>
    </div>
  </div>
</WorkspacePanel>
```

### 验证
- 后台编辑页能看到"精选状态"面板
- 切换后保存，数据库 `featured` 字段更新

---

## Phase 4：前台首页

**文件：** `src/app/(public)/page.tsx`

### 任务

1. 导入 `getFeaturedPosts`：
   ```ts
   import { getFeaturedPosts, getPublishedPostsPage } from '@/lib/posts'
   ```

2. `getData()` 中并行获取精选文章：
   ```ts
   const [postsPageResult, categoriesResult, featuredResult] = await Promise.allSettled([
     getPublishedPostsPage({ page: 1, limit: POSTS_PAGE_SIZE }),
     prisma.category.findMany({ ... }),
     getFeaturedPosts(3),
   ])
   const featuredPosts = featuredResult.status === 'fulfilled' ? featuredResult.value : []
   ```

3. 首页组件中用精选文章填充 HomeFeaturedGrid，不再按位置切片：
   ```ts
   const [featuredLead, ...featuredSecondary] = featuredPosts
   // latestPosts 仍从 posts 中取，但排除已在精选中的 id
   const featuredIds = new Set(featuredPosts.map(p => p.id))
   const latestPosts = posts.filter(p => !featuredIds.has(p.id)).slice(0, 4)
   ```

4. 传给 `HomeFeaturedGrid`：
   ```tsx
   <HomeFeaturedGrid
     leadPost={featuredLead ?? null}
     secondaryPosts={featuredSecondary.slice(0, 2)}
   />
   ```

### 验证
- 无精选文章时 `HomeFeaturedGrid` 不渲染（已有 `if (!leadPost) return null`）
- 有精选文章时首页正确展示

---

## Phase 5：前台文章列表页

**文件：** `src/components/blog/PostsListingClient.tsx`

### 任务

`ListingPost` interface 加入 `featured: boolean`。

渲染逻辑改为：精选文章用 `PostCardFeatured`（带精选标注），非精选用 `PostCard`：

```tsx
{posts.map((post, index) => (
  <div key={post.id} {...getListRevealAnimationProps(index)}>
    {post.featured
      ? <PostCardFeatured post={post} />
      : <PostCard post={post} />
    }
  </div>
))}
```

> 因为 `getPublishedPostsPage` 的 `orderBy` 已改为 `featured desc`，精选文章自然置顶，无需额外排序。

### 精选标注

`PostCardFeatured` 右侧内容区已有 `<span className="ui-chip">精选文章</span>`（第 52 行），无需额外改动。

### 验证
- 文章列表页精选文章排在最前
- 精选文章卡片显示"精选文章" chip

---

## Phase 6：最终验证

```bash
# 类型检查
pnpm tsc --noEmit

# 构建
pnpm build

# 手动验证路径
# 1. 后台标注一篇文章为精选 → 保存
# 2. 首页 HomeFeaturedGrid 显示该文章
# 3. /posts 页该文章置顶且有"精选文章"标注
# 4. 标注第 2、3 篇精选 → 首页 secondaryPosts 正确填充
# 5. 取消所有精选 → 首页 HomeFeaturedGrid 不渲染
```

---

## 改动文件汇总

| 文件 | 改动类型 |
|------|---------|
| `prisma/schema.prisma` | 新增字段 + 索引 |
| `src/lib/validation.ts` | 新增 `featured` 验证 |
| `src/lib/ai-authoring.ts` | 新增 `featured` 写入 |
| `src/lib/posts.ts` | 新增 `featured` 到 select、新增 `getFeaturedPosts`、orderBy 加精选置顶 |
| `src/app/api/admin/posts/[id]/route.ts` | GET select 加 `featured` |
| `src/app/admin/posts/[id]/edit/page.tsx` | formData + 精选状态 panel |
| `src/app/(public)/page.tsx` | 改用 `getFeaturedPosts` 填充首页 |
| `src/components/blog/PostsListingClient.tsx` | 精选文章用 PostCardFeatured 渲染 |
