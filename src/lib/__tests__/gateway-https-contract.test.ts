import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "vitest"

interface NginxDirective {
  name: string
  args: string[]
}

interface NginxBlock {
  name: string
  args: string[]
  directives: NginxDirective[]
  blocks: NginxBlock[]
}

function stripNginxCommentsAndTokenize(source: string): string[] {
  const tokens: string[] = []
  let current = ""
  let quote: "'" | '"' | null = null
  let inComment = false

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!

    if (inComment) {
      if (ch === "\n") {
        inComment = false
      }
      continue
    }

    if (quote) {
      current += ch
      if (ch === "\\" && i + 1 < source.length) {
        i += 1
        current += source[i]!
        continue
      }
      if (ch === quote) {
        quote = null
      }
      continue
    }

    if (ch === "#") {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
      inComment = true
      continue
    }

    if (ch === "'" || ch === '"') {
      quote = ch
      current += ch
      continue
    }

    if (ch === "{" || ch === "}" || ch === ";") {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
      tokens.push(ch)
      continue
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
      continue
    }

    current += ch
  }

  if (quote) {
    throw new Error(`Unclosed quote (${quote}) in Nginx configuration`)
  }
  if (current.length > 0) {
    tokens.push(current)
  }

  return tokens
}

function parseNginxConfig(source: string): NginxBlock {
  const tokens = stripNginxCommentsAndTokenize(source)
  const root: NginxBlock = { name: "http", args: [], directives: [], blocks: [] }
  const stack: NginxBlock[] = [root]
  let pending: string[] = []

  for (const token of tokens) {
    const current = stack[stack.length - 1]
    if (!current) {
      throw new Error("Unexpected extra closing brace in Nginx configuration")
    }

    if (token === ";") {
      if (pending.length === 0) {
        throw new Error("Empty directive before ';' in Nginx configuration")
      }
      const [name, ...args] = pending
      current.directives.push({ name: name!, args })
      pending = []
      continue
    }

    if (token === "{") {
      if (pending.length === 0) {
        throw new Error("Anonymous block '{' in Nginx configuration")
      }
      const [name, ...args] = pending
      const child: NginxBlock = { name: name!, args, directives: [], blocks: [] }
      current.blocks.push(child)
      stack.push(child)
      pending = []
      continue
    }

    if (token === "}") {
      if (pending.length > 0) {
        throw new Error(`Unterminated directive before '}': ${pending.join(" ")}`)
      }
      if (stack.length <= 1) {
        throw new Error("Unmatched closing brace '}' in Nginx configuration")
      }
      stack.pop()
      continue
    }

    pending.push(token)
  }

  if (pending.length > 0) {
    throw new Error(`Trailing directive missing ';': ${pending.join(" ")}`)
  }
  if (stack.length !== 1) {
    throw new Error(`Unclosed '{' block in Nginx configuration (depth ${stack.length - 1})`)
  }

  return root
}

function getDirectiveValues(block: NginxBlock, name: string): string[][] {
  return block.directives.filter((directive) => directive.name === name).map((directive) => directive.args)
}

function getProxySetHeaderMap(block: NginxBlock): Map<string, string> {
  const headers = new Map<string, string>()
  for (const args of getDirectiveValues(block, "proxy_set_header")) {
    const [headerName, ...rest] = args
    if (headerName) {
      headers.set(headerName, rest.join(" "))
    }
  }
  return headers
}

function extractWorkflowRunScript(workflowSource: string): string {
  const lines = workflowSource.replace(/\r\n/g, "\n").split("\n")
  const runLineIndex = lines.findIndex((line) => /^\s*run:\s*\|\s*$/.test(line))
  if (runLineIndex === -1) {
    throw new Error("Could not find `run: |` block in workflow")
  }

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
    if (indent <= runIndent) {
      break
    }

    if (scriptIndent === null) {
      scriptIndent = indent
    }
    bodyLines.push(line.slice(scriptIndent))
  }

  return bodyLines.join("\n").trim() + "\n"
}

function extractCurlCommands(scriptSource: string): string[] {
  const normalized = scriptSource.replace(/\\\n\s*/g, " ")
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /(?:^|\$\()curl\s/.test(line))
}

function validateHttpsProductionBaseUrl(value: string | undefined): boolean {
  if (!value) return false
  return /^https:\/\/.+/.test(value)
}

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

function executeWorkflowRunScript(
  bashPath: string,
  script: string,
  envOverrides: Record<string, string | undefined>
): { status: number | null; stdout: string; stderr: string; curlCalls: string[] } {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "inkforge-b2-cron-test-"))
  const mockBinDir = path.join(tempDir, "bin")
  mkdirSync(mockBinDir, { recursive: true })

  const scriptFile = path.join(tempDir, "step.sh")
  const curlLogFile = path.join(tempDir, "curl-calls.log")
  writeFileSync(curlLogFile, "", "utf8")
  writeFileSync(scriptFile, script, "utf8")

  // Stub curl & sleep so workflow scripts execute deterministically offline.
  writeFileSync(
    path.join(mockBinDir, "sleep"),
    "#!/usr/bin/env bash\nexit 0\n",
    { mode: 0o755 }
  )
  writeFileSync(
    path.join(mockBinDir, "curl"),
    `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$MOCK_CURL_LOG"
output_file=""
write_http_code=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output)
      output_file="$2"
      shift 2
      ;;
    --write-out)
      write_http_code=1
      shift 2
      ;;
    *)
      shift 1
      ;;
  esac
done
if [ -n "$output_file" ]; then
  printf '{"status":"SUCCEEDED"}' > "$output_file"
fi
if [ "$write_http_code" = "1" ]; then
  printf '200'
fi
`,
    { mode: 0o755 }
  )

  const asPosix = (filePath: string) => filePath.replaceAll("\\", "/")
  const runnerCommand =
    process.platform === "win32"
      ? 'export PATH="$(cygpath -u "$MOCK_BIN"):$PATH"; exec bash "$(cygpath -u "$STEP_SCRIPT")"'
      : 'export PATH="$MOCK_BIN:$PATH"; exec bash "$STEP_SCRIPT"'

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MOCK_BIN: asPosix(mockBinDir),
    MOCK_CURL_LOG: asPosix(curlLogFile),
    STEP_SCRIPT: asPosix(scriptFile),
    AI_NEWS_CRON_SECRET: "test-ai-news-secret",
    CRON_SECRET: "test-cron-secret",
    PUBLISH_SCHEDULED_CRON_SECRET: "test-publish-secret",
    INPUT_DATE: "2026-11-22",
    INPUT_REGENERATE: "false",
  }

  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete childEnv[key]
    } else {
      childEnv[key] = value
    }
  }

  try {
    const result = spawnSync(bashPath, ["-c", runnerCommand], {
      cwd: tempDir,
      encoding: "utf8",
      timeout: 15000,
      env: childEnv,
    })
    if (result.error) {
      throw result.error
    }

    const rawCalls = readFileSync(curlLogFile, "utf8")
    const curlCalls = rawCalls
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      curlCalls,
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

const REQUIRED_AI_TIMEOUT_LOCATIONS = [
  "/api/admin/ai/",
  "/api/admin/covers/generate",
  "/api/admin/posts/",
  "/api/ai/drafts",
] as const

const CRON_WORKFLOW_SPECS = [
  {
    relativePath: ".github/workflows/daily-ai-news.yml",
    concurrencyGroup: "cron-daily-ai-news",
    expectedPathSuffix: "/api/cron/ai-news",
    expectedCurlCount: 2,
  },
  {
    relativePath: ".github/workflows/log-retention.yml",
    concurrencyGroup: "cron-log-retention",
    expectedPathSuffix: "/api/cron/log-retention",
    expectedCurlCount: 1,
  },
  {
    relativePath: ".github/workflows/publish-scheduled.yml",
    concurrencyGroup: "cron-publish-scheduled",
    expectedPathSuffix: "/api/cron/publish-scheduled",
    expectedCurlCount: 1,
  },
] as const

describe("Unit B2: Nginx HTTPS gateway hardening contract", () => {
  const nginxConfigPath = path.join(process.cwd(), "deploy/nginx.my-next-app.conf")
  const nginxSource = readFileSync(nginxConfigPath, "utf8")
  const ast = parseNginxConfig(nginxSource)

  test("parses cleanly with balanced braces, server_tokens off, and WebSocket connection upgrade map", () => {
    expect(nginxSource).not.toContain("47.98.167.32")
    expect(nginxSource).not.toContain('Connection "upgrade"')

    expect(getDirectiveValues(ast, "server_tokens")).toEqual([["off"]])

    const mapBlocks = ast.blocks.filter((block) => block.name === "map")
    expect(mapBlocks).toHaveLength(1)
    expect(mapBlocks[0]!.args).toEqual(["$http_upgrade", "$connection_upgrade"])
    expect(getDirectiveValues(mapBlocks[0]!, "default")).toEqual([["upgrade"]])
    expect(getDirectiveValues(mapBlocks[0]!, "''")).toEqual([["close"]])
  })

  test("configures port 80 solely for ACME HTTP-01 challenge and 301 HTTPS redirect", () => {
    const serverBlocks = ast.blocks.filter((block) => block.name === "server")
    const httpServer = serverBlocks.find((server) =>
      getDirectiveValues(server, "listen").some((args) => args[0] === "80")
    )

    expect(httpServer).toBeDefined()
    const listenArgs = getDirectiveValues(httpServer!, "listen")
    expect(listenArgs).toContainEqual(["80"])
    expect(listenArgs).toContainEqual(["[::]:80"])

    const locations = httpServer!.blocks.filter((block) => block.name === "location")
    const acmeLocation = locations.find((loc) => loc.args.join(" ") === "/.well-known/acme-challenge/")
    expect(acmeLocation).toBeDefined()
    expect(getDirectiveValues(acmeLocation!, "root")).toEqual([["/var/www/certbot"]])
    expect(getDirectiveValues(acmeLocation!, "return")).toEqual([])

    const rootLocation = locations.find((loc) => loc.args.join(" ") === "/")
    expect(rootLocation).toBeDefined()
    expect(getDirectiveValues(rootLocation!, "return")).toEqual([["301", "https://$host$request_uri"]])
    expect(getDirectiveValues(rootLocation!, "proxy_pass")).toEqual([])
  })

  test("terminates TLS 1.2/1.3 + HTTP/2 on port 443 with HSTS, 10m body limit, and safe proxy headers", () => {
    const serverBlocks = ast.blocks.filter((block) => block.name === "server")
    const httpsServer = serverBlocks.find((server) =>
      getDirectiveValues(server, "listen").some((args) => args.includes("443") && args.includes("ssl"))
    )

    expect(httpsServer).toBeDefined()
    const listenArgs = getDirectiveValues(httpsServer!, "listen")
    expect(listenArgs).toContainEqual(["443", "ssl", "http2"])
    expect(listenArgs).toContainEqual(["[::]:443", "ssl", "http2"])

    expect(getDirectiveValues(httpsServer!, "ssl_certificate")).toEqual([
      ["/etc/letsencrypt/live/inkforge/fullchain.pem"],
    ])
    expect(getDirectiveValues(httpsServer!, "ssl_certificate_key")).toEqual([
      ["/etc/letsencrypt/live/inkforge/privkey.pem"],
    ])
    expect(getDirectiveValues(httpsServer!, "ssl_protocols")).toEqual([["TLSv1.2", "TLSv1.3"]])
    expect(getDirectiveValues(httpsServer!, "client_max_body_size")).toEqual([["10m"]])

    const addHeaders = getDirectiveValues(httpsServer!, "add_header")
    expect(
      addHeaders.some(
        (args) => args[0] === "Strict-Transport-Security" && args.join(" ").includes("max-age=31536000")
      )
    ).toBe(true)

    const assertSafeUpstreamProxyLocation = (
      locationBlock: NginxBlock | undefined,
      expectedTimeout: string
    ) => {
      expect(locationBlock).toBeDefined()
      expect(getDirectiveValues(locationBlock!, "proxy_pass")).toEqual([["http://127.0.0.1:3000"]])
      expect(getDirectiveValues(locationBlock!, "proxy_http_version")).toEqual([["1.1"]])
      expect(getDirectiveValues(locationBlock!, "proxy_read_timeout")).toEqual([[expectedTimeout]])
      expect(getDirectiveValues(locationBlock!, "proxy_send_timeout")).toEqual([[expectedTimeout]])

      const headers = getProxySetHeaderMap(locationBlock!)
      expect(headers.get("Host")).toBe("$host")
      expect(headers.get("X-Real-IP")).toBe("$remote_addr")
      expect(headers.get("X-Forwarded-For")).toBe("$remote_addr")
      expect(["https", "$scheme"]).toContain(headers.get("X-Forwarded-Proto"))
      expect(headers.get("Upgrade")).toBe("$http_upgrade")
      expect(headers.get("Connection")).toBe("$connection_upgrade")
    }

    const locations = httpsServer!.blocks.filter((block) => block.name === "location")
    for (const aiPath of REQUIRED_AI_TIMEOUT_LOCATIONS) {
      const aiLocation = locations.find((loc) => loc.args.join(" ") === aiPath)
      assertSafeUpstreamProxyLocation(aiLocation, "180s")
    }

    const defaultLocation = locations.find((loc) => loc.args.join(" ") === "/")
    assertSafeUpstreamProxyLocation(defaultLocation, "60s")
  })
})

describe("Unit B2: Cron workflows HTTPS enforcement and concurrency guards", () => {
  test.each(CRON_WORKFLOW_SPECS)(
    "$relativePath enforces concurrency, removes plaintext fallbacks, and hardens curl",
    ({ relativePath, concurrencyGroup, expectedPathSuffix, expectedCurlCount }) => {
      const workflowPath = path.join(process.cwd(), relativePath)
      const workflow = readFileSync(workflowPath, "utf8")

      expect(workflow).not.toContain("47.98.167.32")
      expect(workflow).not.toContain("http://")
      expect(workflow).not.toContain("--max-time 45")

      expect(workflow).toMatch(
        new RegExp(
          `^concurrency:\\s*\\r?\\n\\s+group:\\s*${concurrencyGroup}\\s*\\r?\\n\\s+cancel-in-progress:\\s*false\\b`,
          "m"
        )
      )
      expect(workflow).toMatch(/^\s*PRODUCTION_BASE_URL:\s*\$\{\{\s*secrets\.PRODUCTION_BASE_URL\s*\}\}\s*$/m)

      const runScript = extractWorkflowRunScript(workflow)
      expect(runScript).toContain("PRODUCTION_BASE_URL must start with https://")
      expect(runScript).toContain(expectedPathSuffix)

      const curlCommands = extractCurlCommands(runScript)
      expect(curlCommands).toHaveLength(expectedCurlCount)
      for (const curlCommand of curlCommands) {
        expect(curlCommand).toContain("--proto '=https'")
        expect(curlCommand).toContain("--tlsv1.2")
        expect(curlCommand).toContain("--max-time 30")
      }
    }
  )

  test("validates https:// prefix helper against missing, plaintext, bare scheme, and valid HTTPS URLs", () => {
    expect(validateHttpsProductionBaseUrl(undefined)).toBe(false)
    expect(validateHttpsProductionBaseUrl("")).toBe(false)
    expect(validateHttpsProductionBaseUrl("http://47.98.167.32")).toBe(false)
    expect(validateHttpsProductionBaseUrl("http://blog.example.com")).toBe(false)
    expect(validateHttpsProductionBaseUrl("https://")).toBe(false)
    expect(validateHttpsProductionBaseUrl("https://blog.example.com")).toBe(true)
  })

  test.each(CRON_WORKFLOW_SPECS)(
    "executes extracted $relativePath shell script against empty, http://, and https:// PRODUCTION_BASE_URL",
    ({ relativePath, expectedPathSuffix, expectedCurlCount }) => {
      const bashPath = resolveBashExecutable()
      if (!bashPath) {
        return
      }

      const workflow = readFileSync(path.join(process.cwd(), relativePath), "utf8")
      const runScript = extractWorkflowRunScript(workflow)

      const emptyResult = executeWorkflowRunScript(bashPath, runScript, {
        PRODUCTION_BASE_URL: "",
      })
      expect(emptyResult.status).not.toBe(0)
      expect(emptyResult.stderr).toContain("PRODUCTION_BASE_URL must start with https://")
      expect(emptyResult.curlCalls).toEqual([])

      const unsetResult = executeWorkflowRunScript(bashPath, runScript, {
        PRODUCTION_BASE_URL: undefined,
      })
      expect(unsetResult.status).not.toBe(0)
      expect(unsetResult.stderr).toContain("PRODUCTION_BASE_URL must start with https://")
      expect(unsetResult.curlCalls).toEqual([])

      const httpResult = executeWorkflowRunScript(bashPath, runScript, {
        PRODUCTION_BASE_URL: "http://47.98.167.32",
      })
      expect(httpResult.status).not.toBe(0)
      expect(httpResult.stderr).toContain("PRODUCTION_BASE_URL must start with https://")
      expect(httpResult.curlCalls).toEqual([])

      const httpsResult = executeWorkflowRunScript(bashPath, runScript, {
        PRODUCTION_BASE_URL: "https://blog.example.com/",
      })
      expect(httpsResult.status).toBe(0)
      expect(httpsResult.curlCalls).toHaveLength(expectedCurlCount)
      for (const call of httpsResult.curlCalls) {
        expect(call).toContain("--proto =https")
        expect(call).toContain("--tlsv1.2")
        expect(call).toContain("--max-time 30")
        expect(call).toContain(`https://blog.example.com${expectedPathSuffix}`)
        expect(call).not.toContain(`https://blog.example.com//`)
      }
    }
  )
})
