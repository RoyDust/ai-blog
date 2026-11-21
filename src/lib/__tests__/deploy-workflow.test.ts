import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { parse } from "dotenv"
import { describe, expect, test } from "vitest"

const deployWorkflowPath = path.join(process.cwd(), ".github/workflows/deploy.yml")
const deployWorkflow = readFileSync(deployWorkflowPath, "utf8")

function extractAllRunBlocks(workflowSource: string): string[] {
  const lines = workflowSource.replace(/\r\n/g, "\n").split("\n")
  const blocks: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!
    const multilineMatch = line.match(/^(\s*)run:\s*\|\s*$/)
    if (multilineMatch) {
      const runIndent = multilineMatch[1]!.length
      let scriptIndent: number | null = null
      const body: string[] = []
      let j = i + 1
      for (; j < lines.length; j += 1) {
        const next = lines[j]!
        if (next.trim().length === 0) {
          body.push("")
          continue
        }
        const indent = next.match(/^(\s*)/)?.[1]?.length ?? 0
        if (indent <= runIndent) {
          break
        }
        if (scriptIndent === null) scriptIndent = indent
        body.push(next.slice(scriptIndent))
      }
      i = j - 1
      blocks.push(body.join("\n"))
      continue
    }
    const inlineMatch = line.match(/^(\s*)run:\s+(.+)$/)
    if (inlineMatch) {
      blocks.push(inlineMatch[2]!)
    }
  }
  return blocks
}

function resolveBashExecutable(): string | null {
  const candidates =
    process.platform === "win32"
      ? ["C:/Program Files/Git/bin/bash.exe", "C:/Program Files (x86)/Git/bin/bash.exe"]
      : ["/bin/bash", "/usr/bin/bash"]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const probe = spawnSync(candidate, ["-c", "exit 0"], { encoding: "utf8", timeout: 5000 })
    if (!probe.error && probe.status === 0) return candidate
  }
  return null
}

describe("deploy workflow", () => {
  test("keeps SSH connections alive during long remote activation steps", () => {
    expect(deployWorkflow).toContain("SSH_KEEPALIVE_OPTS")
    expect(deployWorkflow).toContain("ServerAliveInterval=30")
    expect(deployWorkflow).toContain("ServerAliveCountMax=20")
    expect(deployWorkflow).toContain("ssh $SSH_KEEPALIVE_OPTS -p")
    expect(deployWorkflow).toContain('rsync -az --delete -e "ssh $SSH_KEEPALIVE_OPTS -p')
    expect(deployWorkflow).toContain("scp $SSH_KEEPALIVE_OPTS -P")
  })

  test("never interpolates ${{ ... }} directly inside shell run: blocks", () => {
    const runBlocks = extractAllRunBlocks(deployWorkflow)
    expect(runBlocks.length).toBeGreaterThanOrEqual(10)
    for (const block of runBlocks) {
      expect(block).not.toMatch(/\$\{\{/)
    }
  })

  test("uploads per-release 0600 .env and updates shared/.env + current only after deploy-remote.sh succeeds", () => {
    expect(deployWorkflow).toContain(
      'scp $SSH_KEEPALIVE_OPTS -P "$DEPLOY_PORT" app.env "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/releases/${RESOLVED_SHA}/.env"',
    )
    expect(deployWorkflow).not.toContain('shared/.env" "${release_dir}/.env"')
    const deployCallIndex = deployWorkflow.indexOf("bash scripts/deploy/deploy-remote.sh")
    const sharedEnvUpdateIndex = deployWorkflow.indexOf('install -m 600 "${release_dir}/.env" "${DEPLOY_PATH}/shared/.env"')
    const currentSwitchIndex = deployWorkflow.indexOf('ln -sfn "${DEPLOY_PATH}/releases/${RESOLVED_SHA}" "${DEPLOY_PATH}/current"')
    expect(deployCallIndex).toBeGreaterThan(-1)
    expect(sharedEnvUpdateIndex).toBeGreaterThan(deployCallIndex)
    expect(currentSwitchIndex).toBeGreaterThan(deployCallIndex)
  })

  test("serializes cron secrets with literal $ safety and supports pre-#60 commits without read-dotenv.cjs", () => {
    const bash = resolveBashExecutable()
    if (!bash) return

    const runBlocks = extractAllRunBlocks(deployWorkflow)
    const writeEnvBlock = runBlocks.find((b) => b.includes("RAW_APP_ENV_FILE") && b.includes("AI_NEWS_CRON_SECRET"))
    const buildBlock = runBlocks.find((b) => b.includes("read-dotenv.cjs") && b.includes("docker compose"))
    expect(writeEnvBlock).toBeDefined()
    expect(buildBlock).toBeDefined()

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "inkforge-deploy-wf-test-"))
    try {
      const aiSecret = 'ai$secret${UNSET}$$literal"back\\slash'
      const cronSecret = "cron$secret${HOME}$$value!#space"
      const rawAppEnv = [
        'DATABASE_URL="postgresql://postgres:pass@127.0.0.1:5432/app?schema=public"',
        'AUTH_SECRET="prod-auth-secret-value"',
        'NEXTAUTH_SECRET="${AUTH_SECRET}"',
        'NEXTAUTH_URL="https://roydust.top"',
        'NEXT_PUBLIC_SITE_URL="https://roydust.top"',
        'COMPOSE_PROJECT_NAME="current"',
      ].join("\n")

      writeFileSync(path.join(tempDir, "write-env.sh"), writeEnvBlock!, "utf8")
      const writeRes = spawnSync(
        bash,
        ["-c", 'exec bash "$SCRIPT_FILE"'],
        {
          cwd: tempDir,
          encoding: "utf8",
          env: {
            ...process.env,
            SCRIPT_FILE: path.join(tempDir, "write-env.sh").replaceAll("\\", "/"),
            RAW_APP_ENV_FILE: rawAppEnv,
            RAW_AI_NEWS_CRON_SECRET: aiSecret,
            RAW_CRON_SECRET: cronSecret,
          },
        },
      )
      expect(writeRes.status).toBe(0)
      const appEnvContent = readFileSync(path.join(tempDir, "app.env"), "utf8")
      // Single-quoted literal avoids Docker Compose $ interpolation while matching dotenv.parse
      expect(appEnvContent).toContain(`AI_NEWS_CRON_SECRET='${aiSecret}'`)
      expect(appEnvContent).toContain(`CRON_SECRET='${cronSecret}'`)
      expect(parse(appEnvContent).AI_NEWS_CRON_SECRET).toBe(aiSecret)
      expect(parse(appEnvContent).CRON_SECRET).toBe(cronSecret)

      // Simulate pre-#60 historical commit where scripts/deploy/read-dotenv.cjs does NOT exist
      const fallbackSnippet = buildBlock!
        .split("\n")
        .filter((line) => !line.trim().startsWith("docker "))
        .concat(['printf "%s|%s|%s" "$NEXTAUTH_URL" "$NEXT_PUBLIC_SITE_URL" "$COMPOSE_PROJECT_NAME"'])
        .join("\n")
      writeFileSync(path.join(tempDir, "fallback-build.sh"), fallbackSnippet, "utf8")

      const fallbackRes = spawnSync(
        bash,
        ["-c", 'exec bash "$SCRIPT_FILE"'],
        {
          cwd: tempDir,
          encoding: "utf8",
          env: {
            ...process.env,
            NODE_PATH: path.join(process.cwd(), "node_modules"),
            SCRIPT_FILE: path.join(tempDir, "fallback-build.sh").replaceAll("\\", "/"),
          },
        },
      )
      expect(fallbackRes.status).toBe(0)
      expect(fallbackRes.stdout).toBe("https://roydust.top|https://roydust.top|current")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
