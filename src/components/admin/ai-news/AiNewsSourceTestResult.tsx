"use client"

import { formatIsoDate } from "@/lib/editorial-format"
import { cn } from "@/lib/cn"

import type { AiNewsSourceTestResult as SourceTestResult } from "./types"

function formatTestedAt(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const time = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
  return `${formatIsoDate(date)} ${time}`
}

/**
 * 来源测试结果（行下展开）：左侧 2px 语气色竖线；通过 success 附候选数、时间和样例链接，失败 danger + 错误信息（role=alert）。
 */
export function AiNewsSourceTestResult({ result }: { result: SourceTestResult }) {
  const passed = result.status === "success"

  return (
    <div
      role={passed ? "status" : "alert"}
      className={cn("border-l-2 py-0.5 pl-3 text-xs", passed ? "border-[var(--success)]" : "border-[var(--danger-foreground)]")}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[var(--text-muted)]">
        <span className={cn("font-sans font-bold", passed ? "text-[var(--success)]" : "text-[var(--danger-foreground)]")}>
          {passed ? "测试通过" : "测试失败"}
        </span>
        <span>
          <span className="font-sans">候选</span> {result.itemCount}
        </span>
        <span aria-hidden="true">·</span>
        <span>{formatTestedAt(result.testedAt)}</span>
      </div>
      <p className={cn("mt-1.5 leading-5", passed ? "text-[var(--text-body)]" : "text-[var(--danger-foreground)]")}>{result.message}</p>
      {result.sampleItems.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[var(--foreground)] marker:text-[var(--text-muted)]">
          {result.sampleItems.map((item) => (
            <li key={`${item.title}-${item.url}`} className="truncate">
              <a className="hover:underline hover:decoration-[var(--accent-sky)] hover:underline-offset-4" href={item.url} target="_blank" rel="noreferrer">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
