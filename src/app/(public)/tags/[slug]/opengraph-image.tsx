import { getBlogSettings } from "@/lib/blog-settings";

import { contentType, renderTopicOpenGraphImage, size } from "../../_og/topic-opengraph-image";

export { contentType, size };

async function getTag(slug: string) {
  const { prisma } = await import("@/lib/prisma");

  return prisma.tag.findFirst({
    where: { slug, deletedAt: null },
    select: {
      name: true,
      _count: { select: { posts: { where: { published: true, deletedAt: null } } } },
    },
  });
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [settings, tag] = await Promise.all([getBlogSettings(), getTag(slug)]);
  const name = tag?.name || slug;

  return renderTopicOpenGraphImage({
    siteName: settings.siteName,
    badge: "标签",
    title: `#${name}`,
    description: `浏览与 ${name} 相关的文章、案例和连续阅读入口。`,
    countLabel: `共 ${tag?._count.posts ?? 0} 篇文章`,
  });
}
