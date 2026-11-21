import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { NextResponse } from "next/server"

import {
  notifyDailyAiNewsFailure,
  notifyDailyAiNewsSuccess,
  runDailyAiNews,
  type DailyAiNewsRunResult,
} from "@/lib/ai-news"
import { ConflictError, NotFoundError, toErrorResponse, ValidationError } from "@/lib/api-errors"
import { requireInternalSecret } from "@/lib/internal-secrets"
import { prisma } from "@/lib/prisma"

const STALE_RUN_TIMEOUT_MS = 15 * 60 * 1000
const STALE_RUN_ERROR = "Stale RUNNING AI news run reaped after process interruption"
const RUN_STATUS_SELECT = {
  id: true,
  runDate: true,
  createdAt: true,
  finishedAt: true,
  status: true,
  postId: true,
  postTitle: true,
  postSlug: true,
  published: true,
  sourceCount: true,
  selectedCandidateCount: true,
  qualityScore: true,
  citationCoverage: true,
  generationMode: true,
  reviewVerdict: true,
  reviewScore: true,
  reviewSummary: true,
  error: true,
} as const

function requireCronSecret(request: Request) {
  requireInternalSecret(request, { secretName: "AI_NEWS_CRON_SECRET", envKeys: ["AI_NEWS_CRON_SECRET"] })
}

function parseRunDate(request: Request) {
  const value = new URL(request.url).searchParams.get("date")
  if (!value) return new Date()

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid date")
  }

  return date
}

function parseRegenerate(request: Request) {
  const value = new URL(request.url).searchParams.get("regenerate")
  if (value == null || value === "") return false
  return value === "1" || value.toLowerCase() === "true"
}

function parseAfter(request: Request) {
  const value = new URL(request.url).searchParams.get("after")
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid after")
  }

  return date
}

function parseRunId(request: Request) {
  const raw = new URL(request.url).searchParams.get("runId")
  if (raw == null || raw === "") return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 128) {
    throw new ValidationError("Invalid runId")
  }
  return trimmed
}

function formatDateId(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getDateWindow(date: Date) {
  const start = new Date(`${formatDateId(date)}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  return { start, end }
}

function readAlreadyRunningRunId(error: unknown): string | null {
  if (
    error &&
    typeof error === "object" &&
    (error instanceof ConflictError || (error as { code?: string }).code === "AI_NEWS_ALREADY_RUNNING") &&
    (error as { code?: string }).code === "AI_NEWS_ALREADY_RUNNING"
  ) {
    const runId = (error as { runId?: unknown }).runId
    return typeof runId === "string" && runId.trim() ? runId.trim() : null
  }
  return null
}

async function reapStaleCronRuns() {
  const delegate = prisma.aiNewsRun as unknown as {
    updateMany?: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>
  }
  if (typeof delegate?.updateMany !== "function") {
    return
  }

  const now = new Date()
  await delegate.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lte: new Date(now.getTime() - STALE_RUN_TIMEOUT_MS) },
    },
    data: {
      status: "FAILED",
      error: STALE_RUN_ERROR,
      finishedAt: now,
    },
  })
}

async function startDailyAiNewsCronRun({
  authorId,
  date,
  regenerate,
}: {
  authorId: string
  date: Date
  regenerate: boolean
}) {
  const dateId = formatDateId(date)
  type StartupOutcome =
    | { kind: "queued"; run: { id: string; status: "RUNNING" } }
    | { kind: "settled"; result: DailyAiNewsRunResult }

  let resolveStartup!: (outcome: StartupOutcome) => void
  let rejectStartup!: (error: unknown) => void
  const startupPromise = new Promise<StartupOutcome>((resolve, reject) => {
    resolveStartup = resolve
    rejectStartup = reject
  })
  let startupSettled = false

  void (async () => {
    try {
      const runOptions: Parameters<typeof runDailyAiNews>[0] = {
        authorId,
        date,
        regenerate,
        trigger: "cron",
        onRunCreated: (run) => {
          if (!startupSettled) {
            startupSettled = true
            resolveStartup({ kind: "queued", run })
          }
        },
      }
      const result = await runDailyAiNews(runOptions)
      if (!startupSettled) {
        startupSettled = true
        resolveStartup({ kind: "settled", result })
      }
      try {
        await notifyDailyAiNewsSuccess(result, date)
      } catch (error) {
        console.error("Daily AI news success notification failed:", error)
      }
    } catch (error) {
      if (!startupSettled) {
        startupSettled = true
        rejectStartup(error)
        return
      }

      try {
        await notifyDailyAiNewsFailure(date, error)
      } catch (notificationError) {
        console.error("Daily AI news failure notification failed:", notificationError)
      }
      console.error("Daily AI news cron failed:", error)
    }
  })()

  try {
    const startup = await startupPromise
    const run =
      startup.kind === "queued"
        ? startup.run
        : { id: startup.result.run.id, status: "RUNNING" as const }

    return {
      operation: "queued" as const,
      runId: run.id,
      date: dateId,
      run,
    }
  } catch (error) {
    const activeRunId = readAlreadyRunningRunId(error)
    if (activeRunId) {
      return {
        operation: "already-running" as const,
        runId: activeRunId,
        date: dateId,
        run: { id: activeRunId, status: "RUNNING" as const },
      }
    }
    throw error
  }
}

async function POSTHandler(request: Request) {
  try {
    requireCronSecret(request)

    const author = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })

    if (!author) {
      throw new Error("No admin author available for daily AI news")
    }

    const result = await startDailyAiNewsCronRun({
      authorId: author.id,
      date: parseRunDate(request),
      regenerate: parseRegenerate(request),
    })
    return NextResponse.json({ success: true, data: result }, { status: 202 })
  } catch (error) {
    return toErrorResponse(error, "Daily AI news cron failed")
  }
}

async function GETHandler(request: Request) {
  try {
    requireCronSecret(request)
    await reapStaleCronRuns()

    const runId = parseRunId(request)
    const fallbackDate = parseRunDate(request)
    const after = parseAfter(request)

    const run = runId
      ? await prisma.aiNewsRun.findFirst({
          where: { id: runId },
          select: RUN_STATUS_SELECT,
        })
      : await (() => {
          const { start, end } = getDateWindow(fallbackDate)
          return prisma.aiNewsRun.findFirst({
            where: {
              trigger: "CRON",
              runDate: { gte: start, lt: end },
              ...(after ? { createdAt: { gte: after } } : {}),
            },
            orderBy: { createdAt: "desc" },
            select: RUN_STATUS_SELECT,
          })
        })()

    if (runId && !run) {
      throw new NotFoundError("AI news run not found")
    }

    const dateId = run?.runDate instanceof Date ? formatDateId(run.runDate) : formatDateId(fallbackDate)

    if (!run) {
      return NextResponse.json({ success: true, data: { operation: "pending", date: dateId, status: "PENDING" } }, { status: 202 })
    }

    if (run.status === "RUNNING") {
      return NextResponse.json({ success: true, data: { operation: "running", runId: run.id, date: dateId, run } }, { status: 202 })
    }

    if (run.status === "FAILED") {
      return NextResponse.json({ success: false, error: run.error ?? "Daily AI news generation failed", data: { operation: "failed", runId: run.id, date: dateId, run } }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { operation: "finished", runId: run.id, date: dateId, run } })
  } catch (error) {
    return toErrorResponse(error, "Daily AI news cron failed")
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: "cron", operation: "cron.ainews.create", route: "/api/cron/ai-news" })
export const GET = withApiOperationLogging(GETHandler, { scope: "cron", operation: "cron.ainews.read", route: "/api/cron/ai-news" })
