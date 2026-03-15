import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"

type DashScopePayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

function extractSummary(payload: DashScopePayload) {
  const content = payload.choices?.[0]?.message?.content

  if (typeof content === "string") {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim()
  }

  return ""
}

function normalizeSummary(summary: string) {
  return summary.replace(/^['"“”‘’\s]+|['"“”‘’\s]+$/g, "").replace(/\s+/g, " ").trim()
}

export async function POST(request: Request) {
  try {
    await requireAdminSession()

    const body = (await request.json()) as { title?: string; content?: string }
    const content = body.content?.trim()

    if (!content) {
      throw new ValidationError("Article content is required")
    }

    const apiKey = process.env.DASHSCOPE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "DASHSCOPE_API_KEY is not configured" }, { status: 500 })
    }

    const baseUrl = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
    const model = process.env.DASHSCOPE_MODEL ?? "qwen3.5-flash"
    const prompt = [
      "请根据下面的文章内容生成一段中文摘要。",
      "要求：",
      "1. 仅输出摘要正文，不要标题、引号、项目符号或 Markdown。",
      "2. 控制在 70 到 120 个中文字符内。",
      "3. 准确概括主题、核心观点与读者价值。",
      body.title?.trim() ? `文章标题：${body.title.trim()}` : undefined,
      `文章内容：\n${content}`,
    ]
      .filter(Boolean)
      .join("\n\n")

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是一个擅长提炼博客文章摘要的编辑助手。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 220,
      }),
    })

    const payload = (await response.json()) as DashScopePayload

    if (!response.ok) {
      return NextResponse.json({ error: payload.error?.message || "Summary generation failed" }, { status: 502 })
    }

    const summary = normalizeSummary(extractSummary(payload))
    if (!summary) {
      return NextResponse.json({ error: "Summary generation failed" }, { status: 502 })
    }

    return NextResponse.json({ success: true, data: { summary } })
  } catch (error) {
    return toErrorResponse(error, "Summary generation failed")
  }
}
