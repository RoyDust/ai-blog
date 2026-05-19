import { getBlogSettings } from "@/lib/blog-settings";

import { contentType, renderTopicOpenGraphImage, size } from "../../_og/topic-opengraph-image";

export { contentType, size };

async function getSeries(slug: string) {
  const { prisma } = await import("@/lib/prisma");

  return prisma.series.findFirst({
    where: {
      slug,
      deletedAt: null,
      posts: { some: { deletedAt: null, published: true } },
    },
    select: {
      title: true,
      description: true,
      _count: { select: { posts: { where: { published: true, deletedAt: null } } } },
    },
  });
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [settings, series] = await Promise.all([getBlogSettings(), getSeries(slug)]);
  const title = series?.title || slug;

  return renderTopicOpenGraphImage({
    siteName: settings.siteName,
    badge: "系列",
    title,
    description: series?.description || `按顺序浏览 ${title} 系列中的已发布文章。`,
    countLabel: `共 ${series?._count.posts ?? 0} 篇文章`,
  });
}
