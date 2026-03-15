import { describe, expect, test } from 'vitest'

import { calculateReadingTimeMinutes } from '@/lib/reading-time'

describe('calculateReadingTimeMinutes', () => {
  test('returns 1 for empty or whitespace content', () => {
    expect(calculateReadingTimeMinutes('')).toBe(1)
    expect(calculateReadingTimeMinutes('   \n\t')).toBe(1)
  })

  test('keeps short markdown content at one minute', () => {
    expect(calculateReadingTimeMinutes('# 标题\n\n这是一段很短的内容。')).toBe(1)
  })

  test('returns more than one minute for long-form content', () => {
    const longContent = Array.from({ length: 900 }, () => '阅读').join('')

    expect(calculateReadingTimeMinutes(longContent)).toBeGreaterThan(1)
  })
})
