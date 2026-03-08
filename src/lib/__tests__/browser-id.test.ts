import { describe, expect, test } from 'vitest'

import { getBrowserIdFromHeaders, getOrCreateBrowserId, maskIpAddress } from '@/lib/browser-id'

describe('browser identity helpers', () => {
  test('creates and reuses a browser id in localStorage', () => {
    const first = getOrCreateBrowserId()
    const second = getOrCreateBrowserId()

    expect(first).toMatch(/^anon_/)
    expect(second).toBe(first)
  })

  test('normalizes browser id from request headers', () => {
    const headers = new Headers({ 'x-browser-id': '  anon_test-123  ' })

    expect(getBrowserIdFromHeaders(headers)).toBe('anon_test-123')
  })

  test('falls back to null when browser id header is missing', () => {
    expect(getBrowserIdFromHeaders(new Headers())).toBeNull()
  })

  test('masks ipv4 and ipv6 addresses for public display', () => {
    expect(maskIpAddress('203.0.113.42')).toBe('203.0.*.*')
    expect(maskIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:db8:*:*')
  })

  test('returns a safe fallback when ip is absent', () => {
    expect(maskIpAddress(null)).toBe('匿名访客')
    expect(maskIpAddress('')).toBe('匿名访客')
  })
})
