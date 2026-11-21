import Link from "next/link"
import { revalidatePath } from "next/cache"
import type { ReactNode } from "react"

import { MetricStrip } from "@/components/admin/lists"
import { adminHairlineRowClassName, adminTabClassName, adminTextActionClassName } from "@/components/admin/primitives/admin-classes"
import { PageHeader } from "@/components/admin/primitives/PageHeader"
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader"
import { StatusBadge } from "@/components/admin/primitives/StatusBadge"
import { Button } from "@/components/admin/ui"
import { ActiveUnderline, EmptyState } from "@/components/editorial"
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
  NEW: "info",
  WATCHING: "warning",
  PLANNED: "success",
  DRAFTED: "success",
  ARCHIVED: "muted",
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
      <button className={adminTextActionClassName} type="submit">{children}</button>
    </form>
  )
}

function DraftActionButton({ topic }: { topic: AiTopicListItem }) {
  return (
    <form action={createDraftAction}>
      <input name="topicId" type="hidden" value={topic.id} />
      <button className={adminTextActionClassName} type="submit" disabled={topic.status === "DRAFTED"}>
        生成草稿
      </button>
    </form>
  )
}

function TopicCard({ topic }: { topic: AiTopicListItem }) {
  const tone = statusTone[topic.status as keyof typeof statusTone] ?? "neutral"
  const candidates = topic.candidates
    .map((link) => link.candidate)
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))

  return (
    <article className={`${adminHairlineRowClassName} py-4`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1 text-xs text-[var(--text-muted)]">
            <StatusBadge tone={tone}>{statusLabels[topic.status] ?? topic.status}</StatusBadge>
            <span className="ed-meta-sep">·</span>
            <span className="font-mono tabular-nums">热度 {topic.heat}</span>
            <span className="ed-meta-sep">·</span>
            <span className="font-mono tabular-nums">评分 {topic.score}</span>
            <span className="ed-meta-sep">·</span>
            <span className="font-mono tabular-nums">来源 {topic.sourceCount}</span>
            <span className="ed-meta-sep">·</span>
            <span className="font-mono tabular-nums">首次 {formatDate(topic.firstSeenAt)}</span>
            <span className="ed-meta-sep">·</span>
            <span className="font-mono tabular-nums">最近 {formatDate(topic.lastSeenAt)}</span>
            {topic.postId ? (
              <>
                <span className="ed-meta-sep">·</span>
                <span className="font-mono">草稿 {topic.postId}</span>
              </>
            ) : null}
          </div>
          <h2 className="mt-1.5 font-serif text-[1.0625rem] leading-snug font-bold text-[var(--foreground)]">{topic.title}</h2>
          {topic.summary ? <p className="mt-1 text-[0.875rem] leading-6 text-[var(--text-body)]">{topic.summary}</p> : null}
          {topic.angle ? <p className="mt-1 border-l-2 border-[var(--focus)] pl-3 text-[0.8125rem] leading-6 text-[var(--text-muted)]">{topic.angle}</p> : null}

          {topic.tags.length > 0 || topic.riskFlags.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {topic.tags.map((tag) => (
                <span key={tag} className="ed-tag">
                  #{tag}
                </span>
              ))}
              {topic.riskFlags.map((flag) => (
                <span key={flag} className="font-bold text-[var(--warning)]">
                  {flag}
                </span>
              ))}
            </p>
          ) : null}

          {candidates.length > 0 ? (
            <ul className="mt-2.5 border-t border-[var(--border)]">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="flex min-w-0 items-baseline gap-2 border-b border-[var(--border)] py-1.5 text-[0.8125rem]">
                  <a className="min-w-0 truncate text-[var(--text-body)] underline decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4 transition-colors hover:text-[var(--foreground)] hover:decoration-[var(--accent-sky)]" href={candidate.url} target="_blank" rel="noreferrer">
                    {candidate.title}
                  </a>
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                    {candidate.sourceName} · {candidate.aiScore == null ? "未评分" : `评分 ${candidate.aiScore}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3.5 lg:justify-end">
          <TopicActionButton topicId={topic.id} status="WATCHING">设为观察</TopicActionButton>
          <TopicActionButton topicId={topic.id} status="PLANNED">加入规划</TopicActionButton>
          <DraftActionButton topic={topic} />
          <TopicActionButton topicId={topic.id} status="ARCHIVED">归档</TopicActionButton>
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

  const riskyCount = topics.filter((topic) => topic.riskFlags.length > 0).length
  const topHeat = topics.reduce((max, topic) => Math.max(max, topic.heat), 0)
  const activeLabel = statusLabels[activeStatus] ?? activeStatus

  return (
    <div>
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

      <MetricStrip
        ariaLabel="选题概况"
        className="mt-1"
        items={[
          { key: "count", label: activeLabel, value: topics.length.toLocaleString("zh-CN"), note: "当前状态下的选题" },
          { key: "heat", label: "最高热度", value: topHeat.toLocaleString("zh-CN"), note: "按来源数与时效加权" },
          { key: "risk", label: "带风险标记", value: riskyCount.toLocaleString("zh-CN"), note: "成稿前需要人工核实", tone: riskyCount > 0 ? "warning" : "default" },
        ]}
      />

      <section aria-labelledby="admin-ai-topics-title" className="mt-6">
        <AdminSectionHeader
          aside={<span className="ed-mono">{activeLabel}：{topics.length} 个选题</span>}
          description="热度、分数、来源与编辑状态"
          id="admin-ai-topics-title"
          title="选题雷达"
        />
        <nav aria-label="选题状态" className="flex flex-wrap items-center gap-1 pt-3 pb-3.5">
          {statusTabs.map((tab) => {
            const active = activeStatus === tab.status

            return (
              <Link key={tab.status} aria-current={active ? "page" : undefined} className={adminTabClassName} href={topicHref(tab.status)}>
                {tab.label}
                {active ? <ActiveUnderline layoutId="admin-ai-topic-status" /> : null}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-[var(--reader-border-strong)]">
          {topics.length === 0 ? (
            <EmptyState description="点击「重新生成选题」从最近 7 天的候选里沉淀。" role="status" title="当前状态下暂无选题。" />
          ) : (
            topics.map((topic) => <TopicCard key={topic.id} topic={topic} />)
          )}
        </div>
      </section>
    </div>
  )
}
