import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const reliabilityFiles = [
  'src/lib/external-reliability.ts',
  'src/lib/openai-compatible-completion-client.ts',
  'src/lib/external-content-client.ts',
]

describe('outbound reliability dependency boundaries', () => {
  it('keeps leaf reliability and transport clients independent of framework/business modules', async () => {
    for (const file of reliabilityFiles) {
      const source = await readFile(file, 'utf8')
      const imports = source.match(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?$/gm) ?? []
      expect(imports.join('\n')).not.toMatch(/@\/lib\/(?:prisma|ai-|posts|search)|(?:^|['"])(?:next)(?:['"]|\/)/i)
    }
  })

  it('does not make the image protocol depend on completion/content clients', async () => {
    const source = await readFile('src/lib/ai-cover-image.ts', 'utf8')
    expect(source).not.toMatch(/openai-compatible-completion-client|external-content-client/)
  })
})
