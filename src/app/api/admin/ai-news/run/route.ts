import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import {
  notifyDailyAiNewsFailure,
  notifyDailyAiNewsSuccess,
  runDailyAiNews,
  type DailyAiNewsRunResult,
} from "@/lib/ai-news"
import { ConflictError, NotFoundError, toErrorResponse, ValidationError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

const STALE_RUN_TIMEOUT_MS = 15 * 60 * 1000
const STALE_RUN_ERROR = "Stale RUNNING AI news run reaped after process interruption"

function parseRunDate(value: unknown) {
  if (value == null || value === "") return new Date()
  if (typeof value !== "string") throw new ValidationError("Invalid date")

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid date")
  }

  return date
}

function parseModelId(value: unknown) {
  if (value == null || value === "") return null
  if (typeof value !== "string") throw new ValidationError("Invalid model")

  return value.trim() || null
}

function parseRegenerate(value: unknown) {
  if (value == null) return false
  if (typeof value !== "boolean") throw new ValidationError("Invalid regenerate flag")

  return value
}

function parseSourceSelection(payload: { sourceMode?: unknown; sourceIds?: unknown }) {
  if (payload.sourceMode == null || payload.sourceMode === "" || payload.sourceMode === "default") {
    return { sourceMode: "default" as const, sourceIds: undefined }
  }

  if (payload.sourceMode !== "selected") {
    throw new ValidationError("Invalid source mode")
  }

  if (!Array.isArray(payload.sourceIds)) {
    throw new ValidationError("sourceIds must be an array")
  }

  const sourceIds = Array.from(
    new Set(payload.sourceIds.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)),
  )
  if (sourceIds.length === 0) {
    throw new ValidationError("At least one AI news source must be selected")
  }

  return { sourceMode: "selected" as const, sourceIds }
}

function parseRunId(request?: Request) {
  if (!request) return null
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

function isAlreadyRunningConflict(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error instanceof ConflictError || (error as { code?: string }).code === "AI_NEWS_ALREADY_RUNNING") &&
      (error as { code?: string }).code === "AI_NEWS_ALREADY_RUNNING",
  )
}

async function reapStaleAdminRuns() {
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

async function startManualDailyAiNewsRun({
  authorId,
  date,
  modelId,
  regenerate,
  sourceSelection,
}: {
  authorId: string
  date: Date
  modelId: string | null
  regenerate: boolean
  sourceSelection: ReturnType<typeof parseSourceSelection>
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
      const result = await runDailyAiNews({
        authorId,
        date,
        modelId,
        regenerate,
        trigger: "manual",
        ...(sourceSelection.sourceMode === "selected" ? sourceSelection : {}),
        onRunCreated: (run) => {
          if (!startupSettled) {
            startupSettled = true
            resolveStartup({ kind: "queued", run })
          }
        },
      })
      if (!startupSettled) {
        startupSettled = true
        resolveStartup({ kind: "settled", result })
      }
      await notifyDailyAiNewsSuccess(result, date)
    } catch (error) {
      if (!startupSettled) {
        startupSettled = true
        rejectStartup(error)
        if (!isAlreadyRunningConflict(error) && !(error instanceof ValidationError)) {
          await notifyDailyAiNewsFailure(date, error)
        }
        return
      }

      await notifyDailyAiNewsFailure(date, error)
      console.error("Daily AI news manual run failed:", error)
    }
  })()

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
}

async function POSTHandler(request: Request) {
  try {
    const session = await requireAdminSession()
    const body = await request.json().catch(() => ({}))
    const payload = body as {
      date?: unknown
      modelId?: unknown
      regenerate?: unknown
      sourceMode?: unknown
      sourceIds?: unknown
    }
    const date = parseRunDate(payload.date)
    const modelId = parseModelId(payload.modelId)
    const regenerate = parseRegenerate(payload.regenerate)
    const sourceSelection = parseSourceSelection(payload)

    const queued = await startManualDailyAiNewsRun({
      authorId: session.user.id,
      date,
      modelId,
      regenerate,
      sourceSelection,
    })

    return NextResponse.json({ success: true, data: queued }, { status: 202 })
  } catch (error) {
    return toErrorResponse(error, "Daily AI news generation failed")
  }
}

async function GETHandler(request?: Request) {
  try {
    await requireAdminSession()
    await reapStaleAdminRuns()

    const runId = parseRunId(request)
    if (runId) {
      const delegate = prisma.aiNewsRun as unknown as {
        findFirst?: (args: { where: { id: string } }) => Promise<{ id: string; status: string } | null>
        findUnique?: (args: { where: { id: string } }) => Promise<{ id: string; status: string } | null>
      }
      const run = delegate.findFirst
        ? await delegate.findFirst({ where: { id: runId } })
        : delegate.findUnique
          ? await delegate.findUnique({ where: { id: runId } })
          : null
      if (!run) {
        throw new NotFoundError("AI news run not found")
      }

      return NextResponse.json({ success: true, data: run }, { status: run.status === "RUNNING" ? 202 : 200 })
    }

    const runs = await prisma.aiNewsRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return NextResponse.json({ success: true, data: runs })
  } catch (error) {
    return toErrorResponse(error, "Failed to load daily AI news runs")
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: "admin", operation: "admin.ainews.run.create", route: "/api/admin/ai-news/run" })
export const GET = withApiOperationLogging(GETHandler, { scope: "admin", operation: "admin.ainews.run.read", route: "/api/admin/ai-news/run" })
