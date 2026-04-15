import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const deployScriptPath = path.join(process.cwd(), "scripts/deploy/deploy-remote.sh");
const deployScript = readFileSync(deployScriptPath, "utf8");

describe("deploy-remote.sh", () => {
  test("clears loopback proxy environment before docker compose build", () => {
    expect(deployScript).toContain('clear_loopback_proxy_var "HTTP_PROXY"');
    expect(deployScript).toContain('clear_loopback_proxy_var "HTTPS_PROXY"');
    expect(deployScript).toContain('clear_loopback_proxy_var "ALL_PROXY"');
    expect(deployScript).toContain('clear_loopback_proxy_var "http_proxy"');
    expect(deployScript).toContain('clear_loopback_proxy_var "https_proxy"');
    expect(deployScript).toContain('clear_loopback_proxy_var "all_proxy"');

    const proxyCleanupIndex = deployScript.indexOf('clear_loopback_proxy_var "HTTP_PROXY"');
    const composeUpIndex = deployScript.indexOf('docker compose -f "$COMPOSE_FILE" up -d --build');
    expect(proxyCleanupIndex).toBeGreaterThan(-1);
    expect(composeUpIndex).toBeGreaterThan(proxyCleanupIndex);
  });

  test("validates required deployment env before stopping containers", () => {
    expect(deployScript).toContain("required_env_vars=(");
    expect(deployScript).toContain('"DATABASE_URL"');
    expect(deployScript).toContain('"AUTH_SECRET"');
    expect(deployScript).toContain('"NEXTAUTH_SECRET"');
    expect(deployScript).toContain('"NEXTAUTH_URL"');
    expect(deployScript).toContain('"NEXT_PUBLIC_SITE_URL"');

    const validationIndex = deployScript.indexOf("required_env_vars=(");
    const composeDownIndex = deployScript.indexOf('docker compose -f "$COMPOSE_FILE" down --remove-orphans');
    expect(validationIndex).toBeGreaterThan(-1);
    expect(composeDownIndex).toBeGreaterThan(validationIndex);
  });
});
