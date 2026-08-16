import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * 契约测试：代码引用的所有环境变量必须出现在 .env.example 中。
 * 防止新增 env 依赖时忘记更新模板（历史上有十余个变量漏登记）。
 */
const ROOT = process.cwd();

const ALLOWLIST = new Set(["NODE_ENV"]); // 运行时内置，无需在模板中登记

function walk(dir: string, filter: (filePath: string) => boolean): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
      results.push(...walk(full, filter));
    } else if (filter(full)) {
      results.push(full);
    }
  }
  return results;
}

function collectSourceFiles() {
  const sources = [
    ...walk(path.join(ROOT, "src"), (f) => /\.(ts|tsx)$/.test(f)),
    path.join(ROOT, "next.config.ts"),
    path.join(ROOT, "middleware.ts"),
    ...walk(path.join(ROOT, "scripts"), (f) => /\.(cjs|mjs|ts)$/.test(f)),
  ];
  return sources;
}

function collectReferencedEnvNames() {
  const names = new Set<string>();
  for (const file of collectSourceFiles()) {
    const content = readFileSync(file, "utf8");

    // 1) 点访问：process.env.NAME
    for (const match of content.matchAll(/process\.env\.([A-Za-z0-9_]+)/g)) {
      names.add(match[1]);
    }

    // 2) 字符串字面量下标访问：process.env["NAME"] / process.env['NAME']
    for (const match of content.matchAll(/process\.env\[\s*["']([A-Za-z0-9_]+)["']\s*\]/g)) {
      names.add(match[1]);
    }

    // 3) 经 read*Env / resolveEnv 辅助函数透传的字面量键（动态下标访问的兜底）
    for (const match of content.matchAll(/read\w*Env\(\s*["']([A-Za-z0-9_]+)["']/g)) {
      names.add(match[1]);
    }
    for (const match of content.matchAll(/resolveEnv\(\s*["']([A-Za-z0-9_]+)["']/g)) {
      names.add(match[1]);
    }

    // 4) middleware 内部密钥注册表的 envKeys 数组字面量
    for (const match of content.matchAll(/envKeys:\s*\[([^\]]*)\]/g)) {
      for (const key of match[1].matchAll(/["']([A-Za-z0-9_]+)["']/g)) {
        names.add(key[1]);
      }
    }
  }
  return names;
}

function collectExampleEnvNames() {
  const content = readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const names = new Set<string>();
  for (const match of content.matchAll(/^\s*([A-Za-z0-9_]+)=/gm)) {
    names.add(match[1]);
  }
  return names;
}

describe("env example contract", () => {
  test("every referenced process.env key is documented in .env.example", () => {
    const referenced = collectReferencedEnvNames();
    const documented = collectExampleEnvNames();
    const missing = [...referenced].filter((name) => !documented.has(name) && !ALLOWLIST.has(name));

    expect(referenced.size).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
