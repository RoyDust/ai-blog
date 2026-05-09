import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { listAiNewsRunCandidates } from "@/lib/ai-news-candidates"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

type AiNewsCandidateDelegate = typeof prisma extends { aiNewsCandidate: infer Delegate } ? Delegate : never
type PrismaWithOptionalAiNewsCandidate = typeof prisma & {
  aiNewsCandidate?: AiNewsCandidateDelegate
}

type JsonRecord = Record<string, unknown>

/**
 * 读取候选列表所属的 AI 新闻运行 id。
 */
function parseRunId(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId")?.trim()
  if (!runId) {
    throw new ValidationError("runId is required")
  }

  return runId
}

/**
 * 解析是否只返回最终入选候选。
 */
function parseSelectedOnly(request: Request) {
  const value = new URL(request.url).searchParams.get("selectedOnly")
  return value === "1" || value === "true"
}

/**
 * 判断未知 JSON 是否是普通对象。
 */
function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/**
 * 从候选元数据中读取讨论链接。
 */
function readDiscussionUrl(value: unknown) {
  if (!isRecord(value) || typeof value.discussionUrl !== "string") {
    return null
  }

  return value.discussionUrl.trim() || null
}

/**
 * 统计候选项可展示的引用数量。
 *
 * 同时合并 enrichment citations 和社区讨论链接，避免重复计算同一 URL。
 */
function citationCountFromCandidate(candidate: { enrichment?: unknown; metadata?: unknown; community?: unknown }) {
  const citationUrls = new Set<string>()
  let anonymousCitationCount = 0

  if (isRecord(candidate.enrichment) && Array.isArray(candidate.enrichment.citations)) {
    for (const citation of candidate.enrichment.citations) {
      if (isRecord(citation) && typeof citation.url === "string" && citation.url.trim()) {
        citationUrls.add(citation.url.trim())
      } else {
        anonymousCitationCount += 1
      }
    }
  }

  for (const discussionUrl of [readDiscussionUrl(candidate.metadata), readDiscussionUrl(candidate.community)]) {
    if (discussionUrl) {
      citationUrls.add(discussionUrl)
    }
  }

  return citationUrls.size + anonymousCitationCount
}

/**
 * 查询一次 AI 新闻运行下的候选项。
 *
 * 返回值会压缩成前端表格需要的字段，并额外计算 citationCount。
 */
export async function GET(request: Request) {
  try {
    await requireAdminSession()
    const aiNewsCandidate = (prisma as PrismaWithOptionalAiNewsCandidate).aiNewsCandidate

    if (!aiNewsCandidate) {
      throw new ValidationError("AI news candidate storage is not ready. Regenerate Prisma Client and restart the server.")
    }

    const candidates = await listAiNewsRunCandidates({
      prisma: { aiNewsCandidate } as unknown as Parameters<typeof listAiNewsRunCandidates>[0]["prisma"],
      runId: parseRunId(request),
      selectedOnly: parseSelectedOnly(request),
    })

    return NextResponse.json({
      success: true,
      data: candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        url: candidate.url,
        sourceType: candidate.sourceType,
        sourceName: candidate.sourceName,
        aiScore: candidate.aiScore,
        aiReason: candidate.aiReason,
        aiTags: candidate.aiTags,
        selected: candidate.selected,
        duplicateOfId: candidate.duplicateOfId,
        citationCount: citationCountFromCandidate(candidate),
      })),
    })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to load AI news candidates")
  }
}
