import { describe, expect, test } from 'vitest'
import { createSecurityHeaders, securityHeaders } from '../security-headers'

describe('security headers', () => {
  test('includes baseline hardening headers', () => {
    const keys = securityHeaders.map((item) => item.key)

    expect(keys).toContain('Content-Security-Policy')
    expect(keys).toContain('Referrer-Policy')
    expect(keys).toContain('X-Content-Type-Options')
  })

  test('enables HSTS only in production', () => {
    expect(createSecurityHeaders('production').map((item) => item.key)).toContain('Strict-Transport-Security')
    expect(createSecurityHeaders('development').map((item) => item.key)).not.toContain('Strict-Transport-Security')

    const hsts = createSecurityHeaders('production').find((item) => item.key === 'Strict-Transport-Security')?.value
    expect(hsts).toBe('max-age=31536000; includeSubDomains')
  })

  test('does not upgrade insecure requests until the image host serves https', () => {
    // 图片主机 project.roydust.top 尚无 https（2026-08-15 核验），
    // 提前启用 upgrade-insecure-requests 会导致所有 http 图片升级为 https 后裂图。
    // 主机启用 TLS 后，本用例应反转为 toContain。
    const csp = createSecurityHeaders('production').find((item) => item.key === 'Content-Security-Policy')?.value

    expect(csp).not.toContain('upgrade-insecure-requests')
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
