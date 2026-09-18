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

describe("ai-news subsystem module boundary", () => {
  test("keeps ai-news modules inside the subsystem directory, not flat in src/lib", () => {
    const libRootFiles = readdirSync(join(process.cwd(), "src/lib"), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
    const flatAiNewsFiles = libRootFiles.filter((name) => /^ai-news([\-.].*)?\.tsx?$/.test(name))

    expect(flatAiNewsFiles).toEqual([])
  })

  test("keeps app layer imports on the @/lib/ai-news barrel, not deep submodule paths", () => {
    const deepImports = listSourceFiles("src/app")
      .map((path) => ({ path, source: readFileSync(join(process.cwd(), path), "utf8") }))
      .filter(({ source }) => /from\s+["']@\/lib\/ai-news\//.test(source))
      .map(({ path }) => path)

    expect(deepImports).toEqual([])
  })
})
