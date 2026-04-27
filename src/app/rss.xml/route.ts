import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/seo'

async function getRssPosts() {
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

export async function GET() {
  const siteUrl = getSiteUrl()
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

          return `
        <item>
          <title>${toCdata(post.title)}</title>
          <link>${postUrl}</link>
          <guid>${postUrl}</guid>
          <description>${toCdata(description)}</description>
          <pubDate>${pubDate.toUTCString()}</pubDate>
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
    <rss version="2.0">
      <channel>
        <title>My Blog</title>
        <link>${siteUrl}</link>
        <description>一个基于 Next.js 构建的现代化博客系统。</description>
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
