import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
      coverImage: true,
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

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      content: body.content,
      excerpt: body.excerpt || null,
      coverImage: body.coverImage || null,
      published: Boolean(body.published),
      publishedAt: body.published ? new Date() : null,
    },
    select: { id: true, slug: true },
  });

  return NextResponse.json({ success: true, data: updated });
}
