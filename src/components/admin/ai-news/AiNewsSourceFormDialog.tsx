"use client"

import { useState, type FormEvent } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { Button, Input } from "@/components/admin/ui"

import type { AiNewsSourceFormState, AiNewsSourceType, PublicAiNewsSource } from "./types"

const sourceTypes: Array<{ value: AiNewsSourceType; label: string }> = [
  { value: "RSS", label: "RSS / Atom" },
  { value: "GITHUB_TRENDING_RSS", label: "GitHub Trending RSS" },
  { value: "GITHUB_RELEASES", label: "GitHub Releases" },
  { value: "HACKERNEWS", label: "Hacker News" },
]

const categories = ["official", "industry", "developer", "community", "github-release"]

function settingNumber(source: PublicAiNewsSource | null, key: string, fallback = "") {
  const value = source?.settings?.[key]
  return typeof value === "number" ? String(value) : fallback
}

function emptyForm(): AiNewsSourceFormState {
  return {
    type: "RSS",
    name: "",
    url: "",
    homepage: "",
    category: "industry",
    enabled: true,
    weight: "50",
    minScore: "",
    fetchLimit: "",
    commentLimit: "3",
    commentTextMaxLength: "500",
  }
}

function sourceToForm(source: PublicAiNewsSource | null): AiNewsSourceFormState {
  if (!source) return emptyForm()

  return {
    id: source.id,
    type: source.type,
    name: source.name,
    url: source.url,
    homepage: source.homepage ?? "",
    category: source.category ?? "",
    enabled: source.enabled,
    weight: String(source.weight),
    minScore: source.minScore == null ? "" : String(source.minScore),
    fetchLimit: source.fetchLimit == null ? "" : String(source.fetchLimit),
    commentLimit: settingNumber(source, "commentLimit", "3"),
    commentTextMaxLength: settingNumber(source, "commentTextMaxLength", "500"),
  }
}

export function AiNewsSourceFormDialog({
  open,
  source,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  source: PublicAiNewsSource | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (form: AiNewsSourceFormState) => Promise<void>
}) {
  const [form, setForm] = useState<AiNewsSourceFormState>(sourceToForm(source))

  const updateField = <K extends keyof AiNewsSourceFormState>(key: K, value: AiNewsSourceFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit(form)
    onOpenChange(false)
  }

  const isHackerNews = form.type === "HACKERNEWS"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "编辑来源" : "新增来源"}</DialogTitle>
          <DialogDescription>保存后会进入来源库；默认启用表示参与每日自动采集。</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
              来源类型
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                disabled={Boolean(form.id)}
                value={form.type}
                onChange={(event) => updateField("type", event.target.value as AiNewsSourceType)}
              >
                {sourceTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>

            <Input label="来源名称" value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
            <Input
              label={form.type === "GITHUB_RELEASES" ? "仓库 URL" : "来源 URL"}
              placeholder={form.type === "GITHUB_RELEASES" ? "https://github.com/vercel/ai" : "https://example.com/feed.xml"}
              value={form.url}
              onChange={(event) => updateField("url", event.target.value)}
              required={form.type !== "HACKERNEWS"}
            />
            <Input label="主页 URL" value={form.homepage} onChange={(event) => updateField("homepage", event.target.value)} />
            <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
              分类
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
              >
                <option value="">未分类</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <Input label="权重" type="number" min={0} max={200} value={form.weight} onChange={(event) => updateField("weight", event.target.value)} />
            <Input label="抓取上限" type="number" min={1} max={100} value={form.fetchLimit} onChange={(event) => updateField("fetchLimit", event.target.value)} />
            <Input label="最小分数" type="number" min={0} value={form.minScore} onChange={(event) => updateField("minScore", event.target.value)} />
            {isHackerNews ? (
              <>
                <Input label="评论条数" type="number" min={0} max={20} value={form.commentLimit} onChange={(event) => updateField("commentLimit", event.target.value)} />
                <Input
                  label="评论截断长度"
                  type="number"
                  min={80}
                  max={2000}
                  value={form.commentTextMaxLength}
                  onChange={(event) => updateField("commentTextMaxLength", event.target.value)}
                />
              </>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
            <input
              className="ui-checkbox h-4 w-4"
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => updateField("enabled", event.target.checked)}
            />
            默认参与日报
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={saving}>{saving ? "保存中" : "保存来源"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
