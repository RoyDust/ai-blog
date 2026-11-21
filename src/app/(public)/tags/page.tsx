export const revalidate = 300

import type { Metadata } from 'next'

import { TaxonomyDirectoryCard, TaxonomyHero } from '@/components/taxonomy'
import { getBlogSettings } from '@/lib/blog-settings'
import { buildPageMetadata } from '@/lib/seo'
import { getTagDirectory } from '@/lib/taxonomy'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings()

  return buildPageMetadata({
    title: '标签专题',
    description: '从标签维度快速发现相关内容，找到跨分类的主题文章与技术线索。',
    path: '/tags',
    siteUrl: settings.siteUrl,
  })
}

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
    <div className="reader-section">
      <TaxonomyHero
        eyebrow="标签索引"
        title="标签专题"
        description="从具体技术点或关键词横向切入，查看跨分类的相关文章与实践笔记。"
        countLabel={`${tags.length} 个标签 · ${totalPosts} 次内容关联`}
        primaryHref="/posts"
        primaryLabel="去筛选文章"
        secondaryHref="/categories"
        secondaryLabel="浏览分类专题"
      />

      {hasLoadError ? (
        <section role="alert" className="reader-panel border-[var(--danger-border)] bg-[var(--danger-surface)] p-7 text-sm text-[var(--danger-foreground)]">
          标签专题加载失败，请稍后重试。
        </section>
      ) : tags.length > 0 ? (
        <section className="grid gap-3.5 md:grid-cols-2">
          {tags.map((tag: TagDirectoryEntry, index: number) => (
            <div key={tag.id} className="onload-animation" style={{ animationDelay: `${60 + index * 20}ms` }}>
              <TaxonomyDirectoryCard
                href={`/tags/${tag.slug}`}
                name={`#${tag.name}`}
                count={tag._count.posts}
                badge="主题标签"
              />
            </div>
          ))}
        </section>
      ) : (
        <section className="reader-panel p-7 text-sm text-[var(--text-muted)]">当前还没有可展示的标签专题。</section>
      )}
    </div>
  )
}
