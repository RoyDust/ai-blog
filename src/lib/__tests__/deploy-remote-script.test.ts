import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const deployScriptPath = path.join(process.cwd(), "scripts/deploy/deploy-remote.sh");
const deployScript = readFileSync(deployScriptPath, "utf8");

describe("deploy-remote.sh", () => {
  test("clears loopback proxy environment before any fallback docker compose build", () => {
    expect(deployScript).toContain('clear_loopback_proxy_var "HTTP_PROXY"');
    expect(deployScript).toContain('clear_loopback_proxy_var "HTTPS_PROXY"');
    expect(deployScript).toContain('clear_loopback_proxy_var "ALL_PROXY"');
    expect(deployScript).toContain('clear_loopback_proxy_var "http_proxy"');
    expect(deployScript).toContain('clear_loopback_proxy_var "https_proxy"');
    expect(deployScript).toContain('clear_loopback_proxy_var "all_proxy"');
    expect(deployScript).toContain('clear_loopback_proxy_var "npm_config_proxy"');
    expect(deployScript).toContain('clear_loopback_proxy_var "npm_config_https_proxy"');
    expect(deployScript).toContain('clear_loopback_proxy_var "NPM_CONFIG_PROXY"');
    expect(deployScript).toContain('clear_loopback_proxy_var "NPM_CONFIG_HTTPS_PROXY"');

    const proxyCleanupIndex = deployScript.indexOf('clear_loopback_proxy_var "HTTP_PROXY"');
    const composeBuildIndex = deployScript.indexOf('docker compose -f "$COMPOSE_FILE" build app');
    expect(proxyCleanupIndex).toBeGreaterThan(-1);
    expect(composeBuildIndex).toBeGreaterThan(proxyCleanupIndex);
  });

  test("validates required deployment env before loading or starting containers", () => {
    expect(deployScript).toContain("required_env_vars=(");
    expect(deployScript).toContain('"DATABASE_URL"');
    expect(deployScript).toContain('"AUTH_SECRET"');
    expect(deployScript).toContain('"NEXTAUTH_SECRET"');
    expect(deployScript).toContain('"NEXTAUTH_URL"');
    expect(deployScript).toContain('"NEXT_PUBLIC_SITE_URL"');

    const validationIndex = deployScript.indexOf("required_env_vars=(");
    const imageLoadIndex = deployScript.indexOf("gzip -dc my-next-app.tar.gz | docker load");
    const composeUpIndex = deployScript.indexOf('docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans');
    expect(validationIndex).toBeGreaterThan(-1);
    expect(imageLoadIndex).toBeGreaterThan(validationIndex);
    expect(composeUpIndex).toBeGreaterThan(validationIndex);
  });

  test("does not stop the current service before a replacement image is ready", () => {
    expect(deployScript).not.toContain('docker compose -f "$COMPOSE_FILE" down --remove-orphans');
    expect(deployScript).toContain("Loading prebuilt Docker image from release bundle");
    expect(deployScript).toContain('docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans');
  });
});
