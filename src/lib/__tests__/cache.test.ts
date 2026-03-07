import { describe, expect, test } from 'vitest'
import { PUBLIC_REVALIDATE_SECONDS, buildPostPath } from '../cache'

describe('cache helpers', () => {
  test('exposes stable public revalidate window', () => {
    expect(PUBLIC_REVALIDATE_SECONDS).toBe(300)
  })

  test('builds canonical post path', () => {
    expect(buildPostPath('hello')).toBe('/posts/hello')
  })
})
