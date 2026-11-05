export const revalidate = 300

import type { Metadata } from 'next'

import { EmptyState, StaggerItem, StaggerList, TextLink } from '@/components/editorial'
import { TaxonomyDirectoryCard, TaxonomyHero, TaxonomyLoadError } from '@/components/taxonomy'
import { getBlogSettings } from '@/lib/blog-settings'
import { buildPageMetadata } from '@/lib/seo'
import { getCategoryDirectory } from '@/lib/taxonomy'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings()

  return buildPageMetadata({
    title: '分类专题',
    description: '围绕内容主题浏览全部分类，快速进入每个专题页并继续阅读相关文章。',
    path: '/categories',
    siteUrl: settings.siteUrl,
  })
}

type CategoryDirectoryEntry = Awaited<ReturnType<typeof getCategoryDirectory>>[number]

export default async function CategoriesPage() {
  let categories: Awaited<ReturnType<typeof getCategoryDirectory>> = []
  let hasLoadError = false

  try {
    categories = await getCategoryDirectory()
  } catch (error) {
    hasLoadError = true
    console.error('Load categories directory error:', error)
  }

  const totalPosts = categories.reduce((sum: number, category: CategoryDirectoryEntry) => sum + category._count.posts, 0)

  return (
    <>
      <TaxonomyHero
        eyebrow="分类"
        title="全部分类"
        description="按主题浏览全部文章。"
        meta={`${categories.length} 个分类 · ${totalPosts} 篇文章`}
        links={[{ href: '/posts', label: '全部文章' }]}
      />

      {hasLoadError ? (
        <TaxonomyLoadError retryHref="/categories" title="分类加载失败，请稍后重试。" />
      ) : categories.length > 0 ? (
        <StaggerList inView as="ul" className="grid md:grid-cols-2 md:gap-x-8" aria-label="分类目录">
          {categories.map((category: CategoryDirectoryEntry) => (
            <StaggerItem key={category.id} as="li">
              <TaxonomyDirectoryCard
                href={`/categories/${category.slug}`}
                name={category.name}
                description={category.description}
                count={category._count.posts}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      ) : (
        <EmptyState
          title="当前还没有可展示的分类"
          actions={<TextLink href="/posts">浏览全部文章</TextLink>}
        />
      )}
    </>
  )
}
