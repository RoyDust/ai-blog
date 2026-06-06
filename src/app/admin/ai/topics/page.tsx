import Link from "next/link"
import { revalidatePath } from "next/cache"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/admin/primitives/PageHeader"
import { StatusBadge } from "@/components/admin/primitives/StatusBadge"
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel"
import { Button } from "@/components/admin/ui"
import { requireAdminSession } from "@/lib/api-auth"
import { createDraftFromTopic, listAiTopics, materializeTopicsFromRecentCandidates, updateAiTopic } from "@/lib/ai-topic-radar"

export const dynamic = "force-dynamic"

type AiTopicsPageSearchParams = {
  status?: string
}

type AiTopicListItem = Awaited<ReturnType<typeof listAiTopics>>[number]

const statusTabs = [
  { label: "新选题", status: "NEW" },
  { label: "观察中", status: "WATCHING" },
  { label: "已规划", status: "PLANNED" },
  { label: "已成稿", status: "DRAFTED" },
  { label: "已归档", status: "ARCHIVED" },
] as const

const statusTone = {
  NEW: "neutral",
  WATCHING: "warning",
  PLANNED: "success",
  DRAFTED: "success",
  ARCHIVED: "neutral",
} as const

const statusLabels: Record<string, string> = {
  NEW: "新选题",
  WATCHING: "观察中",
  PLANNED: "已规划",
  DRAFTED: "已成稿",
  ARCHIVED: "已归档",
}

function topicHref(status?: string) {
  return status ? `/admin/ai/topics?status=${status}` : "/admin/ai/topics"
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-"

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("zh-CN")
}

async function regenerateTopicsAction() {
  "use server"

  await requireAdminSession()
  await materializeTopicsFromRecentCandidates({ days: 7 })
  revalidatePath("/admin/ai/topics")
}

async function updateTopicStatusAction(formData: FormData) {
  "use server"

  await requireAdminSession()
  const topicId = String(formData.get("topicId") ?? "")
  const status = String(formData.get("status") ?? "")
  await updateAiTopic(topicId, { status })
  revalidatePath("/admin/ai/topics")
}

async function createDraftAction(formData: FormData) {
  "use server"

  const session = await requireAdminSession()
  const topicId = String(formData.get("topicId") ?? "")
  await createDraftFromTopic(topicId, session.user.id)
  revalidatePath("/admin/ai/topics")
}

function TopicActionButton({ topicId, status, children }: { topicId: string; status: string; children: ReactNode }) {
  return (
    <form action={updateTopicStatusAction}>
      <input name="topicId" type="hidden" value={topicId} />
      <input name="status" type="hidden" value={status} />
      <Button size="sm" type="submit" variant="outline">{children}</Button>
    </form>
  )
}

function DraftActionButton({ topic }: { topic: AiTopicListItem }) {
  return (
    <form action={createDraftAction}>
      <input name="topicId" type="hidden" value={topic.id} />
      <Button size="sm" type="submit" variant="outline" disabled={topic.status === "DRAFTED"}>
        生成草稿
      </Button>
    </form>
  )
}

function TopicCard({ topic }: { topic: AiTopicListItem }) {
  const tone = statusTone[topic.status as keyof typeof statusTone] ?? "neutral"
  const candidates = topic.candidates
    .map((link) => link.candidate)
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))

  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone}>{statusLabels[topic.status] ?? topic.status}</StatusBadge>
            <span className="text-sm text-[var(--muted)]">热度 {topic.heat}</span>
            <span className="text-sm text-[var(--muted)]">评分 {topic.score}</span>
            <span className="text-sm text-[var(--muted)]">来源 {topic.sourceCount}</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{topic.title}</h2>
          {topic.summary ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{topic.summary}</p> : null}
          {topic.angle ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{topic.angle}</p> : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {topic.tags.map((tag) => (
              <span key={tag} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
                {tag}
              </span>
            ))}
            {topic.riskFlags.map((flag) => (
              <span key={flag} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                {flag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <TopicActionButton topicId={topic.id} status="WATCHING">设为观察</TopicActionButton>
          <TopicActionButton topicId={topic.id} status="PLANNED">加入规划</TopicActionButton>
          <DraftActionButton topic={topic} />
          <TopicActionButton topicId={topic.id} status="ARCHIVED">归档</TopicActionButton>
        </div>
      </div>

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <span>首次发现 {formatDate(topic.firstSeenAt)}</span>
          <span>最近发现 {formatDate(topic.lastSeenAt)}</span>
          {topic.postId ? <span>草稿 {topic.postId}</span> : null}
        </div>

        <div className="mt-3 space-y-2">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
              <a className="text-sm font-medium text-[var(--brand)] hover:underline" href={candidate.url} target="_blank" rel="noreferrer">
                {candidate.title}
              </a>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {candidate.sourceName} · {candidate.aiScore == null ? "未评分" : `评分 ${candidate.aiScore}`}
              </p>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

export default async function AdminAiTopicsPage({
  searchParams,
}: {
  searchParams: Promise<AiTopicsPageSearchParams>
}) {
  const params = await searchParams
  const activeStatus = params.status ?? "NEW"
  const topics = await listAiTopics({ status: activeStatus })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI 雷达"
        title="AI 选题池 / 内容雷达"
        description="把 AI 新闻候选沉淀为可追踪选题，按热度、分数、来源和编辑状态推进到草稿。"
        action={
          <form action={regenerateTopicsAction}>
            <Button type="submit">重新生成选题</Button>
          </form>
        }
      />

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusTabs.map((tab) => {
            const active = activeStatus === tab.status

            return (
              <Link
                key={tab.status}
                href={topicHref(tab.status)}
                className={
                  active
                    ? "rounded-md bg-[var(--primary)] px-3 py-2 text-sm text-white"
                    : "rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                }
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </section>

      <WorkspacePanel title="选题雷达" description={`${statusLabels[activeStatus] ?? activeStatus}：${topics.length} 个选题`} className="border border-[var(--border)]">
        {topics.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">当前状态下暂无选题。</p>
        ) : (
          <div className="space-y-4">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </WorkspacePanel>
    </div>
  )
}
