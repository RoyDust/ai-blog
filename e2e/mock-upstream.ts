import http from "node:http"
import type { AddressInfo } from "node:net"

/**
 * E2E Batch 3 AI 用例的本地 mock 上游。
 *
 * - `/rss`：一个最小 RSS 2.0 feed（可注入 item 标题/URL）
 * - `/chat/completions`：OpenAI 兼容端点，按请求类型返回对应内容：
 *   - 评分（system 含 "score AI news candidates"）→ 评分 JSON
 *   - 日报成文（system 含 "AI 新闻主编"）→ 日报草稿 JSON（title/excerpt/intro/items/trends）
 *   - 其他（摘要/SEO 等）→ 纯文本
 *
 * 用法：`const server = await startMockUpstream()`，`server.baseUrl` 指向 127.0.0.1。
 * Next 服务（另一进程）在服务端 fetch 时可达测试进程监听的端口。
 */

export type MockUpstream = {
  baseUrl: string
  close: () => Promise<void>
  /** 最近一次 chat/completions 请求体（诊断用） */
  lastCompletion: () => unknown
}

type RssItem = {
  title: string
  link: string
}

const DRAFT_JSON = {
  title: "E2E Mock AI 日报：本地流水线验证",
  excerpt: "这是本地 mock 上游生成的日报摘要，用于 E2E 流水线验证，不承载真实内容。",
  intro: "今日 AI 领域由 mock 上游驱动，覆盖本地流水线的评分、成文与发布链路。",
  items: [
    {
      title: "Mock 候选新闻",
      description: "来自本地 RSS mock feed 的候选，用于验证成文链路。",
      keyPoints: ["mock 要点一", "mock 要点二"],
      sourceName: "E2E Mock Feed",
      url: "https://example.com/e2e-mock-news",
    },
  ],
  trends: [{ title: "本地验证", desc: "mock 流水线打通评分与成文。" }],
}

const SCORE_JSON = { score: 9, reason: "mock 高相关", summary: "mock 摘要", tags: ["e2e-mock"], riskFlags: [] }

function respondFor(systemText: string): string {
  if (systemText.includes("score AI news candidates")) return JSON.stringify(SCORE_JSON)
  if (systemText.includes("AI 新闻主编")) return JSON.stringify(DRAFT_JSON)
  return "E2E mock 补全内容，用于本地 mock 上游返回值。"
}

export function startMockUpstream(options: { rssItems?: RssItem[] } = {}): Promise<MockUpstream> {
  const rssItems = options.rssItems ?? []
  let lastCompletion: unknown = null

  const server = http.createServer((request, response) => {
    const url = request.url || "/"

    if (url.startsWith("/rss")) {
      const items = rssItems
        .map(
          (item) => `<item><title>${item.title}</title><link>${item.link}</link><pubDate>${new Date().toUTCString()}</pubDate></item>`,
        )
        .join("")
      response.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" })
      response.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>mock</title>${items}</channel></rss>`)
      return
    }

    if (url.includes("/chat/completions") && request.method === "POST") {
      let body = ""
      request.on("data", (chunk) => {
        body += chunk
      })
      request.on("end", () => {
        try {
          lastCompletion = JSON.parse(body)
        } catch {
          lastCompletion = body
        }

        const parsed = typeof lastCompletion === "object" && lastCompletion !== null ? (lastCompletion as { messages?: Array<{ role: string; content: string }> }) : {}
        const systemText = parsed.messages?.find((message) => message.role === "system")?.content ?? ""

        const payload = {
          id: "mock-completion",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: respondFor(systemText) },
              finish_reason: "stop",
            },
          ],
        }
        response.writeHead(200, { "Content-Type": "application/json" })
        response.end(JSON.stringify(payload))
      })
      return
    }

    response.writeHead(404)
    response.end()
  })

  return new Promise((resolve, reject) => {
    let closeDone: (() => void) | null = null
    const closed = new Promise<void>((done) => {
      closeDone = done
    })
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo
      server.once("close", () => closeDone?.())
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => {
          server.close()
          return closed
        },
        lastCompletion: () => lastCompletion,
      })
    })
  })
}
