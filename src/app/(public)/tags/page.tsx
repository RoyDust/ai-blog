export const revalidate = 300

import type { Metadata } from 'next'

import { TaxonomyDirectoryCard, TaxonomyHero } from '@/components/taxonomy'
import { buildPageMetadata } from '@/lib/seo'
import { getTagDirectory } from '@/lib/taxonomy'

export const metadata: Metadata = buildPageMetadata({
  title: '标签专题',
  description: '从标签维度快速发现相关内容，找到跨分类的主题文章与技术线索。',
  path: '/tags',
})

type TagDirectoryEntry = Awaited<ReturnType<typeof getTagDirectory>>[number]

export default async function TagsPage() {
  let tags: Awaited<ReturnType<typeof getTagDirectory>> = []
  let hasLoadError = false

  try {
    tags = await getTagDirectory()
  } catch (error) {
    hasLoadError = true
    console.error('Load tags directory error:', error)
  }

  const totalPosts = tags.reduce((sum: number, tag: TagDirectoryEntry) => sum + tag._count.posts, 0)

  return (
    <div className="space-y-6">
      <TaxonomyHero
        eyebrow="Tags"
        title="标签专题"
        description="标签适合横向发现内容。你可以从某个技术点切入，看到它如何分布在不同文章与不同主题之间。"
        countLabel={`${tags.length} 个标签 · ${totalPosts} 次内容关联`}
        primaryHref="/posts"
        primaryLabel="去筛选文章"
        secondaryHref="/categories"
        secondaryLabel="浏览分类专题"
      />

      {hasLoadError ? (
        <section role="alert" className="card-base border border-red-200 bg-red-50 p-8 text-sm text-red-700">
          标签专题加载失败，请稍后重试。
        </section>
      ) : tags.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {tags.map((tag: TagDirectoryEntry, index: number) => (
            <div key={tag.id} className="onload-animation" style={{ animationDelay: `${80 + index * 20}ms` }}>
              <TaxonomyDirectoryCard
                href={`/tags/${tag.slug}`}
                name={`#${tag.name}`}
                count={tag._count.posts}
                badge="主题标签"
                accent={tag.color ?? null}
              />
            </div>
          ))}
        </section>
      ) : (
        <section className="card-base p-8 text-sm text-[var(--muted)]">当前还没有可展示的标签专题。</section>
      )}
    </div>
  )
}
