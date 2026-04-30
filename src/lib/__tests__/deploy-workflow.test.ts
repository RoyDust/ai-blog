import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"

const deployWorkflowPath = path.join(process.cwd(), ".github/workflows/deploy.yml")
const deployWorkflow = readFileSync(deployWorkflowPath, "utf8")

describe("deploy workflow", () => {
  test("keeps SSH connections alive during long remote activation steps", () => {
    expect(deployWorkflow).toContain("SSH_KEEPALIVE_OPTS")
    expect(deployWorkflow).toContain("ServerAliveInterval=30")
    expect(deployWorkflow).toContain("ServerAliveCountMax=20")
    expect(deployWorkflow).toContain("ssh $SSH_KEEPALIVE_OPTS -p")
    expect(deployWorkflow).toContain('rsync -az --delete -e "ssh $SSH_KEEPALIVE_OPTS -p')
    expect(deployWorkflow).toContain("scp $SSH_KEEPALIVE_OPTS -P")
  })
})
