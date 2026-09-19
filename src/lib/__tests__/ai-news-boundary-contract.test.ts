import { readdirSync, readFileSync } from "node:fs"
import { extname, join } from "node:path"
import { describe, expect, test } from "vitest"

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"])

function listSourceFiles(relativeDir: string): string[] {
  const entries = readdirSync(join(process.cwd(), relativeDir), { withFileTypes: true })

  return entries.flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry.name}`
    if (entry.isDirectory()) return listSourceFiles(relativePath)
    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) return []
    return [relativePath]
  })
}

function isTestFile(relativePath: string): boolean {
  const segments = relativePath.split("/")
  const fileName = segments[segments.length - 1] ?? ""
  return segments.includes("__tests__") || /\.test\.tsx?$/.test(fileName)
}

describe("ai-news subsystem module boundary", () => {
  test("keeps ai-news modules inside the subsystem directory, not flat in src/lib", () => {
    const libRootFiles = readdirSync(join(process.cwd(), "src/lib"), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
    const flatAiNewsFiles = libRootFiles.filter((name) => /^ai-news([\-.].*)?\.tsx?$/.test(name))

    expect(flatAiNewsFiles).toEqual([])
  })

  test("keeps app layer imports on the @/lib/ai-news barrel, not deep submodule paths", () => {
    // 深路径检测使用单一子串扫描："lib/ai-news/"（含尾斜杠）。这一条同时覆盖以下所有
    // 深层引用向量——任何一种写法都必然包含该子串：
    // - 静态 import / type import / re-export 的 from 子句（"@/lib/ai-news/run/entry"）
    // - 动态 import(...)（import("@/lib/ai-news/notifications")）
    // - require()（require("@/lib/ai-news/types")）
    // - 反引号模板 / 字符串拼接的模块路径
    // - 相对路径深层引用（"../../lib/ai-news/run/entry"）
    // - 零空白 re-export（export*from"@/lib/ai-news/xxx"）
    // - 类型位置的 import()（import("@/lib/ai-news/types").AiNewsRunResult）
    // 而合法 barrel 引用（"@/lib/ai-news"，无尾斜杠）不包含该子串，不会误伤。
    // 测试文件豁免：测试代码可按需引用深层模块——例如 run route 测试用
    // vi.importActual("@/lib/ai-news/notifications") 保留真实通知组装逻辑（T2 的有意安排），
    // 这类引用属于测试桩装配而非应用层边界违规。
    // 扫描范围说明：仅覆盖 src/app（应用层路由与页面）。components / lib 内的
    // 跨子系统引用不在本契约约束范围内。
    const deepPathSubstring = "lib/ai-news/"

    const deepImports = listSourceFiles("src/app")
      .filter((path) => !isTestFile(path))
      .map((path) => ({ path, source: readFileSync(join(process.cwd(), path), "utf8") }))
      .filter(({ source }) => source.includes(deepPathSubstring))
      .map(({ path }) => path)

    expect(deepImports).toEqual([])
  })
})
