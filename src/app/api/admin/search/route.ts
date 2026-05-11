import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import {
  ADMIN_SEARCH_MIN_QUERY_LENGTH,
  EMPTY_ADMIN_SEARCH_REMOTE_RESULTS,
  normalizeAdminSearchQuery,
  type AdminSearchResponse,
} from "@/lib/admin-search";
import { toErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

const COMMENT_STATUS_LABELS: Record<string, string> = {
  APPROVED: "已通过",
  PENDING: "待审核",
  REJECTED: "已驳回",
  SPAM: "已隐藏",
};

async function GETHandler(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const query = normalizeAdminSearchQuery(searchParams.get("q"));

    if (query.length < ADMIN_SEARCH_MIN_QUERY_LENGTH) {
      return NextResponse.json({
        success: true,
        data: { query, results: EMPTY_ADMIN_SEARCH_REMOTE_RESULTS },
      } satisfies AdminSearchResponse);
    }

    const containsQuery = { contains: query, mode: "insensitive" as const };

    const [posts, comments] = await Promise.all([
      prisma.post.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: containsQuery },
            { slug: containsQuery },
            { excerpt: containsQuery },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
          published: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      prisma.comment.findMany({
        where: {
          deletedAt: null,
          OR: [
            { content: containsQuery },
            { authorLabel: containsQuery },
            { post: { title: containsQuery } },
          ],
        },
        select: {
          id: true,
          content: true,
          status: true,
          authorLabel: true,
          createdAt: true,
          post: {
            select: {
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        query,
        results: {
          posts: posts.map((post) => ({
            id: post.id,
            type: "posts" as const,
            title: post.title,
            subtitle: post.slug,
            href: `/admin/posts/${post.id}/edit`,
            badge: post.published ? "已发布" : "草稿",
          })),
          comments: comments.map((comment) => ({
            id: comment.id,
            type: "comments" as const,
            title: comment.content.length > 72 ? `${comment.content.slice(0, 72)}...` : comment.content,
            subtitle: `${comment.authorLabel || "匿名访客"} 评论于《${comment.post.title}》`,
            href: "/admin/comments",
            badge: COMMENT_STATUS_LABELS[comment.status] ?? comment.status,
          })),
        },
      },
    } satisfies AdminSearchResponse);
  } catch (error) {
    return toErrorResponse(error, "Failed to search admin resources");
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: "admin", operation: "admin.search.read", route: "/api/admin/search" });
