import { prisma } from "@/lib/prisma";

export type RecommendationPostSignal = {
  id: string;
  categoryId?: string | null;
  seriesId?: string | null;
  tagIds: string[];
};

export type CandidateSignal = RecommendationPostSignal & {
  viewCount: number;
  likeCount: number;
  publishedAt?: Date | null;
};

export type RecommendedPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  viewCount: number;
  category: {
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  _count: {
    likes: number;
  };
};

export function scoreRecommendationCandidate({
  current,
  candidate,
  now = new Date(),
}: {
  current: RecommendationPostSignal;
  candidate: CandidateSignal;
  now?: Date;
}) {
  if (candidate.id === current.id) return Number.NEGATIVE_INFINITY;

  const currentTagIds = new Set(current.tagIds);
  const tagOverlap = candidate.tagIds.filter((tagId) => currentTagIds.has(tagId)).length;
  const sameCategory = current.categoryId && current.categoryId === candidate.categoryId ? 1 : 0;
  const sameSeries = current.seriesId && current.seriesId === candidate.seriesId ? 1 : 0;
  const ageDays = candidate.publishedAt
    ? Math.max(0, (now.getTime() - candidate.publishedAt.getTime()) / 86_400_000)
    : 365;
  const recency = Math.max(0, 10 - Math.floor(ageDays / 7));

  return tagOverlap * 12 + sameCategory * 6 + sameSeries * 8 + Math.log1p(candidate.viewCount) + candidate.likeCount * 0.8 + recency;
}

function clampRecommendationLimit(limit: number) {
  if (!Number.isFinite(limit)) return 4;
  return Math.min(12, Math.max(1, Math.floor(limit)));
}

export async function getRecommendedPostsForPost({
  postId,
  limit = 4,
  userId,
  excludeRead = false,
  now = new Date(),
}: {
  postId: string;
  limit?: number;
  userId?: string | null;
  excludeRead?: boolean;
  now?: Date;
}) {
  const safeLimit = clampRecommendationLimit(limit);
  const current = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null, published: true },
    select: {
      id: true,
      categoryId: true,
      seriesId: true,
      tags: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  if (!current) return [];

  const readPostIds = new Set<string>();
  if (excludeRead && userId) {
    const readingEvents = await prisma.readingEvent.findMany({
      where: { userId, postId: { not: postId } },
      select: { postId: true },
      distinct: ["postId"],
      take: 200,
    });

    for (const event of readingEvents) {
      readPostIds.add(event.postId);
    }
  }

  const candidates = await prisma.post.findMany({
    where: {
      id: { not: postId, ...(readPostIds.size > 0 ? { notIn: [...readPostIds] } : {}) },
      deletedAt: null,
      published: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      createdAt: true,
      publishedAt: true,
      categoryId: true,
      seriesId: true,
      viewCount: true,
      category: { select: { name: true, slug: true } },
      tags: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
      _count: { select: { likes: true } },
    },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { viewCount: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: Math.max(50, safeLimit * 8),
  });

  const currentSignal = {
    id: current.id,
    categoryId: current.categoryId,
    seriesId: current.seriesId,
    tagIds: current.tags.map((tag) => tag.id),
  };

  return candidates
    .map((candidate) => ({
      post: candidate,
      score: scoreRecommendationCandidate({
        current: currentSignal,
        candidate: {
          id: candidate.id,
          categoryId: candidate.categoryId,
          seriesId: candidate.seriesId,
          tagIds: candidate.tags.map((tag) => tag.id),
          viewCount: candidate.viewCount,
          likeCount: candidate._count.likes,
          publishedAt: candidate.publishedAt,
        },
        now,
      }),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const rightDate = right.post.publishedAt ?? right.post.createdAt;
      const leftDate = left.post.publishedAt ?? left.post.createdAt;
      if (rightDate.getTime() !== leftDate.getTime()) return rightDate.getTime() - leftDate.getTime();
      return left.post.id.localeCompare(right.post.id);
    })
    .slice(0, safeLimit)
    .map(({ post }) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      createdAt: post.createdAt,
      publishedAt: post.publishedAt,
      viewCount: post.viewCount,
      category: post.category,
      tags: post.tags,
      _count: post._count,
    }));
}
