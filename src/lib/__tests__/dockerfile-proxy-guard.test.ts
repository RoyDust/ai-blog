import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const dockerfilePath = path.join(process.cwd(), "Dockerfile");
const dockerfile = readFileSync(dockerfilePath, "utf8");

describe("Dockerfile proxy guard", () => {
  test("clears proxy variables before any pnpm command runs", () => {
    expect(dockerfile).toContain('ENV HTTP_PROXY=""');
    expect(dockerfile).toContain('HTTPS_PROXY=""');
    expect(dockerfile).toContain('ALL_PROXY=""');
    expect(dockerfile).toContain('http_proxy=""');
    expect(dockerfile).toContain('https_proxy=""');
    expect(dockerfile).toContain('all_proxy=""');
    expect(dockerfile).toContain('npm_config_proxy=""');
    expect(dockerfile).toContain('npm_config_https_proxy=""');
    expect(dockerfile).toContain('NPM_CONFIG_PROXY=""');
    expect(dockerfile).toContain('NPM_CONFIG_HTTPS_PROXY=""');

    const proxyGuardIndex = dockerfile.indexOf('ENV HTTP_PROXY=""');
    const firstPnpmIndex = dockerfile.indexOf("pnpm config set registry");
    expect(proxyGuardIndex).toBeGreaterThan(-1);
    expect(firstPnpmIndex).toBeGreaterThan(proxyGuardIndex);
  });

  test("bypasses corepack before the first pnpm command", () => {
    expect(dockerfile).toContain("corepack disable");
    expect(dockerfile).toContain("npm install -g pnpm@10");
    expect(dockerfile).not.toContain("RUN corepack enable");

    const disableCorepackIndex = dockerfile.indexOf("corepack disable");
    const installPnpmIndex = dockerfile.indexOf("npm install -g pnpm@10");
    const firstPnpmIndex = dockerfile.indexOf("pnpm config set registry");

    expect(disableCorepackIndex).toBeGreaterThan(-1);
    expect(installPnpmIndex).toBeGreaterThan(disableCorepackIndex);
    expect(firstPnpmIndex).toBeGreaterThan(installPnpmIndex);
  });
});
