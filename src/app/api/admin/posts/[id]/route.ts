import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePublicContent } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { calculateReadingTimeMinutes } from "@/lib/reading-time";

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await assertAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
      coverImage: true,
      readingTimeMinutes: true,
      categoryId: true,
      tags: {
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
      },
      published: true,
    },
  });

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: post });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await assertAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const readingTimeMinutes = calculateReadingTimeMinutes(body.content);
  // 先取一份旧的 slug / 分类 / 标签，用来在更新后精确刷新受影响的公开页面缓存。
  const existing = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: {
      slug: true,
      category: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  });

  if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      content: body.content,
      excerpt: body.excerpt || null,
      coverImage: body.coverImage || null,
      readingTimeMinutes,
      categoryId: body.categoryId || null,
      tags: Array.isArray(body.tagIds)
        ? {
            // 编辑文章时使用 set 覆盖标签关系，保证删除和新增标签都能一次同步完成。
            set: body.tagIds.map((tagId: string) => ({ id: tagId })),
          }
        : undefined,
      published: Boolean(body.published),
      publishedAt: body.published ? new Date() : null,
    },
    select: {
      id: true,
      slug: true,
      published: true,
      readingTimeMinutes: true,
      category: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  });

  revalidatePublicContent({
    slug: updated.published ? updated.slug : null,
    previousSlug: existing?.slug,
    categorySlug: updated.published ? updated.category?.slug : null,
    previousCategorySlug: existing?.category?.slug,
    tagSlugs: updated.published ? updated.tags.map((tag) => tag.slug) : [],
    previousTagSlugs: existing?.tags.map((tag) => tag.slug) ?? [],
  });

  return NextResponse.json({ success: true, data: updated });
}
