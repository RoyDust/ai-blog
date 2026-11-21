"use client"

import { StatusBadge } from "@/components/admin/primitives/StatusBadge"

import type { AiNewsSourceTestResult as SourceTestResult } from "./types"

function formatTestedAt(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString()
}

export function AiNewsSourceTestResult({ result }: { result: SourceTestResult }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-xs text-[var(--muted)]">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={result.status === "success" ? "success" : "danger"}>
          {result.status === "success" ? "测试通过" : "测试失败"}
        </StatusBadge>
        <span>候选 {result.itemCount}</span>
        <span>{formatTestedAt(result.testedAt)}</span>
      </div>
      <p className="mt-2 leading-5">{result.message}</p>
      {result.sampleItems.length ? (
        <div className="mt-2 space-y-1">
          {result.sampleItems.map((item) => (
            <a key={`${item.title}-${item.url}`} className="block truncate text-[var(--brand)] hover:underline" href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
