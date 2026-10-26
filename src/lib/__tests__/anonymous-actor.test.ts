import { describe, expect, test } from 'vitest'

import { ValidationError } from '@/lib/api-errors'
import { createAnonymousActorId, resolveAnonymousActor } from '@/lib/anonymous-actor'

describe('anonymous actor identity', () => {
  test('keeps the same actor id when the client ip changes', () => {
    const wifi = resolveAnonymousActor(new Headers({ 'x-browser-id': 'anon_device-1', 'x-forwarded-for': '203.0.113.42' }))
    const mobile = resolveAnonymousActor(new Headers({ 'x-browser-id': 'anon_device-1', 'x-forwarded-for': '198.51.100.7' }))

    expect(wifi?.actorId).toMatch(/^anon_[a-f0-9]{64}$/)
    expect(mobile?.actorId).toBe(wifi?.actorId)
  })

  test('derives different actor ids for different browser ids', () => {
    const first = resolveAnonymousActor(new Headers({ 'x-browser-id': 'anon_device-1' }))
    const second = resolveAnonymousActor(new Headers({ 'x-browser-id': 'anon_device-2' }))

    expect(first?.actorId).not.toBe(second?.actorId)
  })

  test('does not expose the raw browser id in the actor id', () => {
    const actor = resolveAnonymousActor(new Headers({ 'x-browser-id': 'anon_device-1' }))

    expect(actor?.browserId).toBe('anon_device-1')
    expect(actor?.actorId).not.toContain('device-1')
  })

  test('still labels the author with the masked client ip', () => {
    const actor = resolveAnonymousActor(new Headers({ 'x-browser-id': 'anon_device-1', 'x-forwarded-for': '203.0.113.42, 10.0.0.1' }))

    expect(actor?.authorLabel).toBe('203.0.*.*')
  })

  test('returns null or throws a validation error when the browser id is missing or malformed', () => {
    expect(resolveAnonymousActor(new Headers())).toBeNull()
    expect(resolveAnonymousActor(new Headers({ 'x-browser-id': 'not-a-browser-id' }))).toBeNull()
    expect(() => createAnonymousActorId(new Headers())).toThrow(ValidationError)
  })
})
