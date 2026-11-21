export const revalidate = 300

import type { Metadata } from 'next'

import { EmptyState, TextLink } from '@/components/editorial'
import { TagDirectoryGroup, TaxonomyHero, TaxonomyLoadError, type TagDirectoryItem } from '@/components/taxonomy'
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

/** 「常用」取文章数前 12 个（简报 16.5） */
const POPULAR_TAG_COUNT = 12

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

  const items: TagDirectoryItem[] = tags.map((tag: TagDirectoryEntry) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    count: tag._count.posts,
  }))
  const popular = items.slice(0, POPULAR_TAG_COUNT)

  return (
    <>
      <TaxonomyHero
        eyebrow="标签"
        title="全部标签"
        description="用标签快速定位具体话题。"
        meta={`${tags.length} 个标签 · ${totalPosts} 次文章关联`}
        links={[{ href: '/posts', label: '全部文章' }]}
      />

      {hasLoadError ? (
        <TaxonomyLoadError retryHref="/tags" title="标签加载失败，请稍后重试。" />
      ) : items.length > 0 ? (
        <>
          {items.length > POPULAR_TAG_COUNT ? (
            <TagDirectoryGroup headingId="tags-popular-title" tags={popular} title="常用" />
          ) : null}
          <TagDirectoryGroup delay={0.06} headingId="tags-all-title" tags={items} title="全部" />
        </>
      ) : (
        <EmptyState
          title="当前还没有可展示的标签"
          actions={<TextLink href="/posts">浏览全部文章</TextLink>}
        />
      )}
    </>
  )
}
