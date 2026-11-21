import type { Prisma } from "@prisma/client";

import { NotFoundError, ValidationError } from "@/lib/api-errors";
import {
  createPublicCachedReader,
  PUBLIC_CACHE_TAGS,
  PUBLIC_REVALIDATE_SECONDS,
  revalidateTopicGuides,
} from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { generatePostSlug } from "@/lib/slug";

export const TOPIC_GUIDE_STATUSES = ["draft", "published", "archived"] as const;

export type TopicGuideStatus = (typeof TOPIC_GUIDE_STATUSES)[number];

export type TopicGuidePostInput = {
  postId: string;
  note?: string | null;
};

export type TopicGuideInput = {
  title: string;
  slug?: string | null;
  description?: string | null;
  status?: TopicGuideStatus;
  postIds?: string[];
  posts?: TopicGuidePostInput[];
};

const MAX_TITLE_LENGTH = 140;
const MAX_SLUG_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_NOTE_LENGTH = 600;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertLength(value: string | null | undefined, fieldName: string, maxLength: number) {
  if (value && value.length > maxLength) {
    throw new ValidationError(`${fieldName} is too long`);
  }
}

function normalizeSlug(title: string, slug?: string | null) {
  const value = normalizeOptionalString(slug) ?? generatePostSlug(title, 80);
  assertLength(value, "slug", MAX_SLUG_LENGTH);

  if (!SLUG_PATTERN.test(value)) {
    throw new ValidationError("Invalid slug");
  }

  return value;
}

function normalizeStatus(status: unknown): TopicGuideStatus {
  if (status == null) return "draft";
  if (typeof status !== "string" || !TOPIC_GUIDE_STATUSES.includes(status as TopicGuideStatus)) {
    throw new ValidationError("Invalid status");
  }

  return status as TopicGuideStatus;
}

function normalizeGuidePosts(input: Pick<TopicGuideInput, "postIds" | "posts">) {
  const source: TopicGuidePostInput[] = input.posts ?? input.postIds?.map((postId) => ({ postId })) ?? [];
  const seen = new Set<string>();

  return source.reduce<Array<{ postId: string; order: number; note: string | null }>>((items, item) => {
    const postId = item.postId.trim();
    if (!postId || seen.has(postId)) return items;

    const note = normalizeOptionalString(item.note);
    assertLength(note, "note", MAX_NOTE_LENGTH);
    seen.add(postId);
    items.push({ postId, order: items.length + 1, note });

    return items;
  }, []);
}

async function assertGuidePostsExist(posts: Array<{ postId: string }>) {
  const postIds = Array.from(new Set(posts.map((post) => post.postId)));
  if (postIds.length === 0) {
    return;
  }

  const existingPosts = await prisma.post.findMany({
    where: { id: { in: postIds }, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existingPosts.map((post) => post.id));
  const missingIds = postIds.filter((postId) => !existingIds.has(postId));

  if (missingIds.length > 0) {
    throw new ValidationError(`Topic guide post not found: ${missingIds.join(", ")}`);
  }
}

export function normalizeTopicGuideInput(input: TopicGuideInput) {
  const title = input.title.trim();
  const description = normalizeOptionalString(input.description);

  if (!title) {
    throw new ValidationError("Invalid title");
  }

  assertLength(title, "title", MAX_TITLE_LENGTH);
  assertLength(description, "description", MAX_DESCRIPTION_LENGTH);

  return {
    title,
    slug: normalizeSlug(title, input.slug),
    description,
    status: normalizeStatus(input.status),
    posts: normalizeGuidePosts(input),
  };
}

export async function createTopicGuide(input: TopicGuideInput) {
  const guide = normalizeTopicGuideInput(input);
  await assertGuidePostsExist(guide.posts);

  const created = await prisma.topicGuide.create({
    data: {
      title: guide.title,
      slug: guide.slug,
      description: guide.description,
      status: guide.status,
      posts: {
        create: guide.posts,
      },
    },
    include: getAdminTopicGuideInclude(),
  });

  revalidateTopicGuides({ slug: created.slug ?? guide.slug });

  return created;
}

export function getAdminTopicGuideInclude() {
  return {
    posts: {
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            published: true,
            deletedAt: true,
          },
        },
      },
      orderBy: [{ order: "asc" as const }, { createdAt: "asc" as const }],
    },
    _count: {
      select: { posts: true },
    },
  } satisfies Prisma.TopicGuideInclude;
}

export async function listAdminTopicGuides() {
  return prisma.topicGuide.findMany({
    where: { deletedAt: null },
    include: getAdminTopicGuideInclude(),
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getAdminTopicGuideById(id: string) {
  const guide = await prisma.topicGuide.findFirst({
    where: { id, deletedAt: null },
    include: getAdminTopicGuideInclude(),
  });

  if (!guide) {
    throw new NotFoundError("Topic guide not found");
  }

  return guide;
}

export async function updateTopicGuide(id: string, input: Partial<TopicGuideInput>) {
  const existing = await prisma.topicGuide.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, slug: true, description: true, status: true },
  });

  if (!existing) {
    throw new NotFoundError("Topic guide not found");
  }

  const title = input.title == null ? existing.title : input.title.trim();
  const description = input.description === undefined ? existing.description : normalizeOptionalString(input.description);
  const slug = input.slug === undefined ? existing.slug : normalizeSlug(title, input.slug);
  const status = input.status === undefined ? existing.status : normalizeStatus(input.status);
  const shouldReplacePosts = input.posts !== undefined || input.postIds !== undefined;
  const posts = shouldReplacePosts ? normalizeGuidePosts(input) : [];

  if (!title) {
    throw new ValidationError("Invalid title");
  }

  assertLength(title, "title", MAX_TITLE_LENGTH);
  assertLength(description, "description", MAX_DESCRIPTION_LENGTH);
  await assertGuidePostsExist(posts);

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.topicGuide.update({
      where: { id },
      data: { title, slug, description, status },
    }),
  ];

  if (shouldReplacePosts) {
    operations.push(prisma.topicGuidePost.deleteMany({ where: { guideId: id } }));

    if (posts.length > 0) {
      operations.push(prisma.topicGuidePost.createMany({ data: posts.map((post) => ({ ...post, guideId: id })) }));
    }
  }

  await prisma.$transaction(operations);

  revalidateTopicGuides({
    slug,
    previousSlug: existing.slug,
  });

  return getAdminTopicGuideById(id);
}

export async function setTopicGuideStatus(id: string, status: TopicGuideStatus) {
  return updateTopicGuide(id, { status });
}

export async function softDeleteTopicGuide(id: string) {
  const guide = await prisma.topicGuide.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true },
  });

  if (!guide) {
    throw new NotFoundError("Topic guide not found");
  }

  const deleted = await prisma.topicGuide.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidateTopicGuides({
    previousSlug: guide.slug ?? deleted?.slug,
  });

  return deleted;
}

const publicGuidePostSelect = {
  id: true,
  title: true,
  slug: true,
  generatedByAiNews: true,
  excerpt: true,
  coverImage: true,
  featured: true,
  createdAt: true,
  readingTimeMinutes: true,
  viewCount: true,
  author: { select: { id: true, name: true, image: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
  _count: {
    select: {
      comments: { where: { deletedAt: null, status: "APPROVED" } },
      likes: true,
    },
  },
} satisfies Prisma.PostSelect;

const publicGuidePostInclude = {
  post: {
    select: publicGuidePostSelect,
  },
} satisfies Prisma.TopicGuidePostInclude;

function reviveDateFields<T extends Record<string, unknown>>(record: T, keys: Array<keyof T>): T {
  let next = record;
  for (const key of keys) {
    const value = next[key];
    if (typeof value === "string") {
      next = { ...next, [key]: new Date(value) };
    }
  }
  return next;
}

async function queryPublicTopicGuides() {
  return prisma.topicGuide.findMany({
    where: {
      status: "published",
      deletedAt: null,
      posts: {
        some: {
          post: { published: true, deletedAt: null },
        },
      },
    },
    include: {
      posts: {
        where: { post: { published: true, deletedAt: null } },
        select: { id: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

const getCachedPublicTopicGuides = createPublicCachedReader(queryPublicTopicGuides, {
  keyParts: ["public-topic-guides-list"],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
  tags: [PUBLIC_CACHE_TAGS.topicGuides, PUBLIC_CACHE_TAGS.posts],
  rehydrate: (guides) =>
    guides.map((guide) =>
      reviveDateFields(guide as unknown as Record<string, unknown>, ["createdAt", "updatedAt", "deletedAt"]) as typeof guide,
    ),
});

export async function listPublicTopicGuides() {
  try {
    return await getCachedPublicTopicGuides();
  } catch (error) {
    if (isMissingTopicGuideStorageError(error)) {
      return [];
    }

    throw error;
  }
}

async function queryPublicTopicGuideBySlug(slug: string) {
  const guide = await prisma.topicGuide.findFirst({
    where: {
      slug,
      status: "published",
      deletedAt: null,
    },
    include: {
      posts: {
        where: { post: { published: true, deletedAt: null } },
        include: publicGuidePostInclude,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return guide ?? null;
}

const getCachedPublicTopicGuideBySlug = createPublicCachedReader(queryPublicTopicGuideBySlug, {
  keyParts: ["public-topic-guide-detail"],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
  tags: [
    PUBLIC_CACHE_TAGS.topicGuides,
    PUBLIC_CACHE_TAGS.posts,
    PUBLIC_CACHE_TAGS.categories,
    PUBLIC_CACHE_TAGS.tags,
  ],
  rehydrate: (guide) => {
    if (!guide) {
      return null;
    }

    const revivedGuide = reviveDateFields(guide as unknown as Record<string, unknown>, [
      "createdAt",
      "updatedAt",
      "deletedAt",
    ]) as typeof guide;

    if (!Array.isArray(revivedGuide.posts)) {
      return revivedGuide;
    }

    return {
      ...revivedGuide,
      posts: revivedGuide.posts.map((item) => {
        const revivedItem = reviveDateFields(item as unknown as Record<string, unknown>, ["createdAt"]) as typeof item;
        if (!revivedItem.post) {
          return revivedItem;
        }

        return {
          ...revivedItem,
          post: reviveDateFields(revivedItem.post as unknown as Record<string, unknown>, ["createdAt"]) as typeof revivedItem.post,
        };
      }),
    };
  },
});

export async function getPublicTopicGuideBySlug(slug: string) {
  try {
    return await getCachedPublicTopicGuideBySlug(slug);
  } catch (error) {
    if (isMissingTopicGuideStorageError(error)) {
      return null;
    }

    throw error;
  }
}

function isMissingTopicGuideStorageError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return (
    code === "42P01" ||
    code === "P2021" ||
    message.includes('relation "topic_guides" does not exist') ||
    message.includes("The table `public.topic_guides` does not exist")
  );
}
