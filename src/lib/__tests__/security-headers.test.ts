import { describe, expect, test } from 'vitest'
import { securityHeaders } from '../security-headers'

describe('security headers', () => {
  test('includes baseline hardening headers', () => {
    const keys = securityHeaders.map((item) => item.key)

    expect(keys).toContain('Content-Security-Policy')
    expect(keys).toContain('Referrer-Policy')
    expect(keys).toContain('X-Content-Type-Options')
  })
})
