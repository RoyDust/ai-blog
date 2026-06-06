import { describe, expect, test } from 'vitest'
import { createSecurityHeaders, securityHeaders } from '../security-headers'

describe('security headers', () => {
  test('includes baseline hardening headers', () => {
    const keys = securityHeaders.map((item) => item.key)

    expect(keys).toContain('Content-Security-Policy')
    expect(keys).toContain('Referrer-Policy')
    expect(keys).toContain('X-Content-Type-Options')
  })

  test('does not allow eval in production scripts', () => {
    const csp = createSecurityHeaders('production').find((item) => item.key === 'Content-Security-Policy')?.value

    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).not.toContain("'unsafe-eval'")
  })

  test('allows eval in development scripts for HMR', () => {
    const csp = createSecurityHeaders('development').find((item) => item.key === 'Content-Security-Policy')?.value

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
  })
})
