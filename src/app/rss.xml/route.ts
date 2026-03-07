import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/seo'

async function getRssPosts() {
  return prisma.post.findMany({
    where: { published: true },
    select: {
      title: true,
      slug: true,
      excerpt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

type RssPost = Awaited<ReturnType<typeof getRssPosts>>[number]

export async function GET() {
  const siteUrl = getSiteUrl()
  let items = ''

  try {
    const posts = await getRssPosts()
    items = posts
      .map(
        (post: RssPost) => `
        <item>
          <title><![CDATA[${post.title}]]></title>
          <link>${siteUrl}/posts/${post.slug}</link>
          <guid>${siteUrl}/posts/${post.slug}</guid>
          <description><![CDATA[${post.excerpt || ''}]]></description>
          <pubDate>${post.createdAt.toUTCString()}</pubDate>
        </item>`,
      )
      .join('')
  } catch (error) {
    console.error('Generate rss error:', error)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>My Blog</title>
        <link>${siteUrl}</link>
        <description>一个基于 Next.js 构建的现代化博客系统。</description>
        ${items}
      </channel>
    </rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
