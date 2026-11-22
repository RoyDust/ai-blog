import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "vitest"

function resolveBashExecutable(): string | null {
  const candidates =
    process.platform === "win32"
      ? ["C:/Program Files/Git/bin/bash.exe", "C:/Program Files (x86)/Git/bin/bash.exe"]
      : ["/bin/bash", "/usr/bin/bash"]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const probe = spawnSync(candidate, ["-c", "exit 0"], { encoding: "utf8", timeout: 5000 })
    if (!probe.error && probe.status === 0) {
      return candidate
    }
  }
  return null
}

function extractWorkflowRunScript(workflowSource: string): string {
  const lines = workflowSource.replace(/\r\n/g, "\n").split("\n")
  const runLineIndex = lines.findIndex((line) => /^\s*run:\s*\|\s*$/.test(line))
  const runIndent = lines[runLineIndex]!.match(/^(\s*)/)?.[1]?.length ?? 0
  const bodyLines: string[] = []
  let scriptIndent: number | null = null

  for (let i = runLineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i]!
    if (line.trim().length === 0) {
      bodyLines.push("")
      continue
    }
    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
    if (indent <= runIndent) break
    if (scriptIndent === null) scriptIndent = indent
    bodyLines.push(line.slice(scriptIndent))
  }
  return bodyLines.join("\n").trim() + "\n"
}

describe("daily AI news workflow", () => {
  test("schedules the protected cron endpoint with production secrets, 100x10s polling, and transient 409 retry", () => {
    const workflow = readFileSync(".github/workflows/daily-ai-news.yml", "utf8")

    expect(workflow).toContain("cron:")
    expect(workflow).toContain("concurrency:")
    expect(workflow).toContain("group: cron-daily-ai-news")
    expect(workflow).toContain("PRODUCTION_BASE_URL must start with https://")
    expect(workflow).toContain("--proto '=https' --tlsv1.2 --max-time 30")
    expect(workflow).toContain("api/cron/ai-news")
    expect(workflow).toContain("regenerate:")
    expect(workflow).toContain("regenerate=true")
    expect(workflow).toContain("INPUT_REGENERATE")
    expect(workflow).toContain("Transient 409 claim race without runId; retrying trigger once...")
    expect(workflow).toContain("Missing runId in daily AI news trigger response")
    expect(workflow).toContain("Polling daily AI news status")
    expect(workflow).toContain("$(seq 1 100)")
    expect(workflow).toContain("runId=${encoded_run_id}")
    expect(workflow).not.toContain("after=${status_after}")
    expect(workflow).toContain("secrets.PRODUCTION_BASE_URL")
    expect(workflow).toContain("secrets.AI_NEWS_CRON_SECRET")
    expect(workflow).toContain("Authorization: Bearer")
  })

  test("retries once on transient empty-runId 409 claim race and then polls the persisted runId", () => {
    const bashPath = resolveBashExecutable()
    if (!bashPath) {
      return
    }

    const workflow = readFileSync(".github/workflows/daily-ai-news.yml", "utf8")
    const script = extractWorkflowRunScript(workflow)
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "inkforge-r2-workflow-test-"))
    const mockBinDir = path.join(tempDir, "bin")
    mkdirSync(mockBinDir, { recursive: true })

    const scriptFile = path.join(tempDir, "step.sh")
    const counterFile = path.join(tempDir, "post-count.txt")
    writeFileSync(counterFile, "0", "utf8")
    writeFileSync(scriptFile, script, "utf8")
    writeFileSync(path.join(mockBinDir, "sleep"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 })
    writeFileSync(
      path.join(mockBinDir, "curl"),
      `#!/usr/bin/env bash
set -eu
output_file=""
request_method="GET"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --request|-X) request_method="$2"; shift 2 ;;
    --output) output_file="$2"; shift 2 ;;
    --write-out) shift 2 ;;
    *) shift 1 ;;
  esac
done
if [ "$request_method" = "POST" ]; then
  count="$(cat "$POST_COUNTER_FILE")"
  next_count=$((count + 1))
  printf '%s' "$next_count" > "$POST_COUNTER_FILE"
  if [ "$next_count" = "1" ]; then
    printf '{"error":"Daily AI news is already running for this date"}' > "$output_file"
    printf '409'
  else
    printf '{"success":true,"data":{"operation":"already-running","runId":"run-recovered-409","run":{"id":"run-recovered-409","status":"RUNNING"}}}' > "$output_file"
    printf '202'
  fi
else
  printf '{"success":true,"data":{"operation":"finished","runId":"run-recovered-409","run":{"id":"run-recovered-409","status":"SUCCEEDED"}}}' > "$output_file"
  printf '200'
fi
`,
      { mode: 0o755 },
    )

    const asPosix = (p: string) => p.replaceAll("\\", "/")
    const runner =
      process.platform === "win32"
        ? 'export PATH="$(cygpath -u "$MOCK_BIN"):$PATH"; exec bash "$(cygpath -u "$STEP_SCRIPT")"'
        : 'export PATH="$MOCK_BIN:$PATH"; exec bash "$STEP_SCRIPT"'

    try {
      const result = spawnSync(bashPath, ["-c", runner], {
        cwd: tempDir,
        encoding: "utf8",
        timeout: 15000,
        env: {
          ...process.env,
          MOCK_BIN: asPosix(mockBinDir),
          STEP_SCRIPT: asPosix(scriptFile),
          POST_COUNTER_FILE: asPosix(counterFile),
          PRODUCTION_BASE_URL: "https://blog.example.com",
          AI_NEWS_CRON_SECRET: "secret",
          INPUT_DATE: "2026-11-22",
          INPUT_REGENERATE: "false",
        },
      })
      expect(result.status).toBe(0)
      expect(result.stderr).toContain("Transient 409 claim race without runId; retrying trigger once...")
      expect(result.stdout).toContain("runId=run-recovered-409")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
