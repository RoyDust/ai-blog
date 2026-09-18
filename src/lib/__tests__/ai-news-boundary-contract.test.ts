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
    // 同时覆盖静态 import（含 type import / re-export 的 from 子句）与动态 import(...) 形式；
    // 匹配要求 ai-news 后跟路径分隔符，barrel 引用（"@/lib/ai-news"，无尾部斜杠）不会误伤。
    // 测试文件豁免：测试代码可按需引用深层模块——例如 run route 测试用
    // vi.importActual("@/lib/ai-news/notifications") 保留真实通知组装逻辑（T2 的有意安排），
    // 这类引用属于测试桩装配而非应用层边界违规。
    const staticDeepImportPattern = /from\s+["']@\/lib\/ai-news\//
    const dynamicDeepImportPattern = /\bimport\s*\(\s*["']@\/lib\/ai-news\//

    const deepImports = listSourceFiles("src/app")
      .filter((path) => !isTestFile(path))
      .map((path) => ({ path, source: readFileSync(join(process.cwd(), path), "utf8") }))
      .filter(({ source }) => staticDeepImportPattern.test(source) || dynamicDeepImportPattern.test(source))
      .map(({ path }) => path)

    expect(deepImports).toEqual([])
  })
})
