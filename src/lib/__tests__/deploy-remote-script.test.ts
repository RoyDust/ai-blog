import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const deployScriptPath = path.join(process.cwd(), "scripts/deploy/deploy-remote.sh");
const deployScript = readFileSync(deployScriptPath, "utf8");

describe("deploy-remote.sh", () => {
  test("production backup runs after candidate validation and before migrations", () => {
    const validation = deployScript.indexOf('app node scripts/check-web-readiness.cjs');
    const backup = deployScript.indexOf('bash scripts/deploy/backup-production.sh');
    const migrations = deployScript.indexOf('\nrun_database_migrations\n');
    expect(backup).toBeGreaterThan(validation);
    expect(migrations).toBeGreaterThan(backup);
    const workflow = readFileSync(path.join(process.cwd(), '.github/workflows/deploy.yml'), 'utf8');
    expect(workflow).toContain('BACKUP_BEFORE_DEPLOY=1');
    expect(workflow.indexOf('bash scripts/deploy/smoke-web-health.sh')).toBeLessThan(workflow.indexOf('name: Upload release bundle'));
  });

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

  test("uses candidate image configuration preflight before migrations or replacement", () => {
    expect(deployScript).not.toContain("required_env_vars=(");
    const validationIndex = deployScript.indexOf('app node scripts/check-web-readiness.cjs');
    const imageLoadIndex = deployScript.indexOf("gzip -dc my-next-app.tar.gz | docker load");
    const composeUpIndex = deployScript.indexOf('docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans');
    expect(validationIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeGreaterThan(imageLoadIndex);
    expect(deployScript.indexOf('\nrun_database_migrations\n')).toBeGreaterThan(validationIndex);
    expect(composeUpIndex).toBeGreaterThan(validationIndex);
  });

  test("does not stop the current service before a replacement image is ready", () => {
    expect(deployScript).not.toContain('docker compose -f "$COMPOSE_FILE" down --remove-orphans');
    expect(deployScript).toContain("Loading prebuilt Docker image from release bundle");
    expect(deployScript).toContain('docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans');
  });

  test("applies database migrations before starting the replacement app", () => {
    expect(deployScript).toContain('docker compose -f "$COMPOSE_FILE" run --rm --no-deps app pnpm prisma migrate deploy');
    expect(deployScript).not.toContain('docker compose -f "$COMPOSE_FILE" exec -T app pnpm prisma migrate deploy');

    const migrateIndex = deployScript.indexOf("\nrun_database_migrations\n");
    const composeUpIndex = deployScript.indexOf('docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans');
    expect(migrateIndex).toBeGreaterThan(-1);
    expect(composeUpIndex).toBeGreaterThan(migrateIndex);
  });
});
