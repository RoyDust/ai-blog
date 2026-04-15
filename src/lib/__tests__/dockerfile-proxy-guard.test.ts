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
    const firstPnpmIndex = dockerfile.indexOf("RUN pnpm config set registry");
    expect(proxyGuardIndex).toBeGreaterThan(-1);
    expect(firstPnpmIndex).toBeGreaterThan(proxyGuardIndex);
  });
});
