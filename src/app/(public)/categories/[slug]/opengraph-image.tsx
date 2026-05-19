import { getBlogSettings } from "@/lib/blog-settings";

import { contentType, renderTopicOpenGraphImage, size } from "../../_og/topic-opengraph-image";

export { contentType, size };

async function getCategory(slug: string) {
  const { prisma } = await import("@/lib/prisma");

  return prisma.category.findFirst({
    where: { slug, deletedAt: null },
    select: {
      name: true,
      description: true,
      _count: { select: { posts: { where: { published: true, deletedAt: null } } } },
    },
  });
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [settings, category] = await Promise.all([getBlogSettings(), getCategory(slug)]);

  const name = category?.name || slug;

  return renderTopicOpenGraphImage({
    siteName: settings.siteName,
    badge: "分类",
    title: name,
    description: category?.description || settings.siteDescription,
    countLabel: `共 ${category?._count.posts ?? 0} 篇文章`,
  });
}
