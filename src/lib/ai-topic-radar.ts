import type { AiTopicStatus } from "@prisma/client"

import { createAdminPost } from "@/lib/ai-authoring"
import { NotFoundError, ValidationError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"
import { generatePostSlug, POST_SLUG_MAX_LENGTH } from "@/lib/slug"

export type CandidateSignal = {
  id: string
  title: string
  url?: string
  summary?: string | null
  aiSummary?: string | null
  aiTags: string[]
  aiScore: number | null
  aiRiskFlags?: string[]
  publishedAt?: Date | null
  createdAt?: Date | null
}

export type TopicCandidateGroup = {
  tag: string
  title: string
  candidateIds: string[]
  sourceCount: number
  heat: number
  score: number
  tags: string[]
  riskFlags: string[]
  firstSeenAt: Date | null
  lastSeenAt: Date | null
}

export type ListAiTopicsInput = {
  status?: string | null
}

export type UpdateAiTopicInput = {
  status?: string | null
  summary?: string | null
  angle?: string | null
}

const candidateSelect = {
  id: true,
  title: true,
  url: true,
  canonicalUrl: true,
  summary: true,
  aiSummary: true,
  aiScore: true,
  aiTags: true,
  aiRiskFlags: true,
  publishedAt: true,
  sourceName: true,
  sourceType: true,
} as const

const topicStatuses = new Set<AiTopicStatus>(["NEW", "WATCHING", "PLANNED", "DRAFTED", "ARCHIVED"])
const fallbackTopicWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "beta",
  "for",
  "from",
  "in",
  "new",
  "of",
  "on",
  "release",
  "releases",
  "ships",
  "the",
  "to",
  "tools",
  "update",
  "with",
])

function normalizeTopicTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "")
}

function topicTitleFromTag(tag: string) {
  return tag
    .split("-")
    .filter(Boolean)
    .map((part) => (/^[a-z]+$/.test(part) && part.length <= 3 ? part.toUpperCase() : part))
    .join(" ")
}

function fallbackTagFromTitle(title: string) {
  const words = title
    .split(/\s+/)
    .map((word) => normalizeTopicTag(word))
    .filter((word) => word && !fallbackTopicWords.has(word))
    .slice(0, 3)

  return words.join("-")
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
}

function newestDate(dates: Array<Date | null | undefined>) {
  const timestamps = dates.map((date) => date?.getTime() ?? Number.NaN).filter(Number.isFinite)
  if (timestamps.length === 0) return null

  return new Date(Math.max(...timestamps))
}

function oldestDate(dates: Array<Date | null | undefined>) {
  const timestamps = dates.map((date) => date?.getTime() ?? Number.NaN).filter(Number.isFinite)
  if (timestamps.length === 0) return null

  return new Date(Math.min(...timestamps))
}

function parseTopicStatus(value: string | null | undefined) {
  if (!value) return undefined

  const status = value.toUpperCase()
  if (!topicStatuses.has(status as AiTopicStatus)) {
    throw new ValidationError("Invalid topic status")
  }

  return status as AiTopicStatus
}

function clampExcerpt(value: string | null | undefined) {
  const text = value?.trim()
  if (!text) return undefined

  return text.length > 320 ? text.slice(0, 317).trimEnd() + "..." : text
}

function slugWithSuffix(baseSlug: string, suffix: number) {
  const suffixText = `-${suffix}`
  return `${baseSlug.slice(0, POST_SLUG_MAX_LENGTH - suffixText.length).replace(/-+$/g, "")}${suffixText}`
}

export function groupTopicCandidates(candidates: CandidateSignal[]): TopicCandidateGroup[] {
  const groups = new Map<string, CandidateSignal[]>()

  for (const candidate of candidates) {
    const tag = normalizeTopicTag(candidate.aiTags[0] || fallbackTagFromTitle(candidate.title))
    if (!tag) continue

    groups.set(tag, [...(groups.get(tag) ?? []), candidate])
  }

  return Array.from(groups.entries())
    .map(([tag, items]) => {
      const scoreSum = items.reduce((sum, item) => sum + (item.aiScore ?? 0), 0)
      const score = Number((scoreSum / Math.max(items.length, 1)).toFixed(2))

      return {
        tag,
        title: topicTitleFromTag(tag),
        candidateIds: items.map((item) => item.id),
        sourceCount: items.length,
        heat: items.length * 10 + Math.round(scoreSum),
        score,
        tags: uniqueValues([tag, ...items.flatMap((item) => item.aiTags ?? []).map(normalizeTopicTag)]),
        riskFlags: uniqueValues(items.flatMap((item) => item.aiRiskFlags ?? [])),
        firstSeenAt: oldestDate(items.map((item) => item.publishedAt ?? item.createdAt)),
        lastSeenAt: newestDate(items.map((item) => item.publishedAt ?? item.createdAt)),
      }
    })
    .sort((left, right) => right.heat - left.heat)
}

export async function materializeTopicsFromRecentCandidates({
  days = 7,
  excludeSelected = false,
}: {
  days?: number
  excludeSelected?: boolean
} = {}) {
  const since = new Date(Date.now() - days * 86_400_000)
  const candidates = await prisma.aiNewsCandidate.findMany({
    where: {
      createdAt: { gte: since },
      duplicateOfId: null,
      ...(excludeSelected ? { selected: false } : {}),
    },
    select: {
      id: true,
      title: true,
      url: true,
      summary: true,
      aiSummary: true,
      aiTags: true,
      aiScore: true,
      aiRiskFlags: true,
      publishedAt: true,
      createdAt: true,
    },
  })

  const groups = groupTopicCandidates(candidates)
  const now = new Date()

  for (const group of groups) {
    await prisma.$transaction(async (tx) => {
      const topic = await tx.aiTopic.upsert({
        where: { slug: group.tag },
        create: {
          title: group.title,
          slug: group.tag,
          score: group.score,
          heat: group.heat,
          sourceCount: group.sourceCount,
          tags: group.tags,
          riskFlags: group.riskFlags,
          firstSeenAt: group.firstSeenAt ?? since,
          lastSeenAt: group.lastSeenAt ?? now,
        },
        update: {
          title: group.title,
          score: group.score,
          heat: group.heat,
          sourceCount: group.sourceCount,
          tags: group.tags,
          riskFlags: group.riskFlags,
          lastSeenAt: group.lastSeenAt ?? now,
        },
      })

      for (const candidateId of group.candidateIds) {
        await tx.aiTopicCandidate.upsert({
          where: { topicId_candidateId: { topicId: topic.id, candidateId } },
          create: { topicId: topic.id, candidateId, relevance: group.score },
          update: { relevance: group.score },
        })
      }
    })
  }

  return groups
}

export async function listAiTopics({ status }: ListAiTopicsInput = {}) {
  const parsedStatus = parseTopicStatus(status)

  const topics = await prisma.aiTopic.findMany({
    where: parsedStatus ? { status: parsedStatus } : undefined,
    orderBy: [{ heat: "desc" }, { score: "desc" }, { updatedAt: "desc" }],
    include: {
      candidates: {
        orderBy: { relevance: "desc" },
      },
    },
  })

  const candidateIds = uniqueValues(topics.flatMap((topic) => topic.candidates.map((link) => link.candidateId)))
  const candidates = candidateIds.length
    ? await prisma.aiNewsCandidate.findMany({
        where: { id: { in: candidateIds } },
        select: candidateSelect,
      })
    : []
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))

  return topics.map((topic) => ({
    ...topic,
    candidates: topic.candidates
      .map((link) => ({
        ...link,
        candidate: candidateById.get(link.candidateId) ?? null,
      }))
      .filter((link) => link.candidate),
  }))
}

export async function getAiTopic(id: string) {
  const topic = await prisma.aiTopic.findUnique({
    where: { id },
    include: {
      candidates: {
        orderBy: { relevance: "desc" },
      },
    },
  })

  if (!topic) {
    throw new NotFoundError("Topic not found")
  }

  const candidateIds = uniqueValues(topic.candidates.map((link) => link.candidateId))
  const candidates = candidateIds.length
    ? await prisma.aiNewsCandidate.findMany({
        where: { id: { in: candidateIds } },
        select: candidateSelect,
      })
    : []
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))

  return {
    ...topic,
    candidates: topic.candidates
      .map((link) => ({
        ...link,
        candidate: candidateById.get(link.candidateId) ?? null,
      }))
      .filter((link) => link.candidate),
  }
}

export async function updateAiTopic(id: string, input: UpdateAiTopicInput) {
  const status = input.status === undefined ? undefined : parseTopicStatus(input.status)

  return prisma.aiTopic.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(input.summary !== undefined ? { summary: input.summary?.trim() || null } : {}),
      ...(input.angle !== undefined ? { angle: input.angle?.trim() || null } : {}),
    },
  })
}

function buildDraftContent(topic: Awaited<ReturnType<typeof getAiTopic>>) {
  const lines = [
    `# ${topic.title}`,
    "",
    topic.summary?.trim() || "从以下来源整理这个选题的事实、背景与写作角度。",
  ]

  if (topic.angle?.trim()) {
    lines.push("", "## 写作角度", "", topic.angle.trim())
  }

  lines.push("", "## 候选来源")

  for (const link of topic.candidates) {
    const candidate = link.candidate
    if (!candidate) continue
    lines.push("", `- [${candidate.title}](${candidate.url})`)

    if (candidate.aiSummary || candidate.summary) {
      lines.push(`  - ${candidate.aiSummary || candidate.summary}`)
    }

    if (typeof candidate.aiScore === "number") {
      lines.push(`  - AI 分数：${candidate.aiScore}`)
    }
  }

  return lines.join("\n")
}

export async function createDraftFromTopic(topicId: string, authorId: string) {
  const topic = await getAiTopic(topicId)
  const baseSlug = generatePostSlug(topic.title)
  let slug = baseSlug
  let suffix = 2

  while (await prisma.post.findUnique({ where: { slug }, select: { id: true } })) {
    slug = slugWithSuffix(baseSlug, suffix)
    suffix += 1
  }

  const post = await createAdminPost({
    authorId,
    input: {
      title: topic.title,
      slug,
      content: buildDraftContent(topic),
      excerpt: clampExcerpt(topic.summary),
      published: false,
      generatedByAiNews: false,
    },
  })

  await prisma.aiTopic.update({
    where: { id: topic.id },
    data: { status: "DRAFTED", postId: post.id },
  })

  return post
}
