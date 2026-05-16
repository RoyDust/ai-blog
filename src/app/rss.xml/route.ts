import { getBlogSettings } from '@/lib/blog-settings'

export const dynamic = 'force-dynamic'

async function getRssPosts() {
  const { prisma } = await import('@/lib/prisma')

  return prisma.post.findMany({
    where: { published: true, deletedAt: null },
    select: {
      title: true,
      slug: true,
      excerpt: true,
      seoDescription: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      author: { select: { name: true } },
      category: { select: { name: true } },
      tags: { where: { deletedAt: null }, select: { name: true } },
    },
    orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 20,
  })
}

type RssPost = Awaited<ReturnType<typeof getRssPosts>>[number]

function toCdata(value: string) {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
}

function buildPostUrl(siteUrl: string, slug: string) {
  return `${siteUrl}/posts/${encodeURIComponent(slug)}`
}

function buildCreator(post: RssPost, fallback: string) {
  return post.author.name || fallback
}

function buildCategories(post: RssPost) {
  return [post.category?.name, ...post.tags.map((tag) => tag.name)].filter((name): name is string => Boolean(name))
}

export async function GET() {
  const settings = await getBlogSettings()
  const siteUrl = settings.siteUrl
  let items = ''
  let lastBuildDate = new Date()

  try {
    const posts = await getRssPosts()
    lastBuildDate = posts[0]?.updatedAt || posts[0]?.publishedAt || posts[0]?.createdAt || lastBuildDate
    items = posts
      .map(
        (post: RssPost) => {
          const postUrl = buildPostUrl(siteUrl, post.slug)
          const description = post.seoDescription || post.excerpt || ''
          const pubDate = post.publishedAt || post.createdAt
          const updatedDate = post.updatedAt || pubDate
          const creator = buildCreator(post, settings.siteName)
          const categories = buildCategories(post)
            .map((category) => `<category>${toCdata(category)}</category>`)
            .join('')

          return `
        <item>
          <title>${toCdata(post.title)}</title>
          <link>${postUrl}</link>
          <guid>${postUrl}</guid>
          <dc:creator>${toCdata(creator)}</dc:creator>
          <description>${toCdata(description)}</description>
          <pubDate>${pubDate.toUTCString()}</pubDate>
          <updated>${updatedDate.toISOString()}</updated>
          ${categories}
        </item>`
        },
      )
      .join('')
  } catch (error) {
    console.error('Generate rss error:', error)
    return new Response('RSS feed generation failed', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel>
        <title>${toCdata(settings.siteName)}</title>
        <link>${siteUrl}</link>
        <description>${toCdata(settings.siteDescription)}</description>
        <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
        ${items}
      </channel>
    </rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
