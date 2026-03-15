const CJK_CHARACTER_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const LATIN_WORD_REGEX = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g
const READING_UNITS_PER_MINUTE = 300

function normalizeMarkdown(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function calculateReadingTimeMinutes(content: string) {
  const normalized = normalizeMarkdown(content)

  if (!normalized) {
    return 1
  }

  const cjkCharacterCount = (normalized.match(CJK_CHARACTER_REGEX) ?? []).length
  const latinWordCount = (normalized.replace(CJK_CHARACTER_REGEX, ' ').match(LATIN_WORD_REGEX) ?? []).length
  const readingUnits = cjkCharacterCount + latinWordCount

  return Math.max(1, Math.ceil(readingUnits / READING_UNITS_PER_MINUTE))
}
