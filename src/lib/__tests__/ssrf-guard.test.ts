import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type * as dns from 'node:dns'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertSafeIpAddress,
  createSsrfSafeAgent,
  createSsrfSafeLookup,
  isBlockedIpAddress,
  safeOutboundFetch,
  validateOutboundUrl,
} from '../ssrf-guard'

describe('ssrf-guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('validateOutboundUrl & isBlockedIpAddress', () => {
    it('accepts valid public HTTP and HTTPS URLs without credentials', () => {
      expect(validateOutboundUrl('https://openai.com/news/rss.xml').toString()).toBe('https://openai.com/news/rss.xml')
      expect(validateOutboundUrl('http://93.184.216.34/feed').toString()).toBe('http://93.184.216.34/feed')
      expect(validateOutboundUrl('https://[2606:4700:4700::1111]/dns-query').toString()).toBe('https://[2606:4700:4700::1111]/dns-query')
      expect(isBlockedIpAddress('93.184.216.34')).toBe(false)
      expect(isBlockedIpAddress('2606:4700:4700::1111')).toBe(false)
    })

    it('rejects non-http(s) schemes and URLs containing credentials', () => {
      for (const bad of [
        'ftp://example.com/file',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:image/png;base64,AAAA',
        'https://user@example.com/private',
        'https://user:pass@example.com/private',
        'not-a-url',
      ]) {
        expect(() => validateOutboundUrl(bad)).toThrowError(expect.objectContaining({ kind: 'configuration', retryable: false }))
      }
    })

    it('rejects loopback, unspecified, RFC1918, link-local, CGNAT/Alibaba ECS metadata, multicast/reserved, and IPv6 ULA/mapped', () => {
      const blockedUrls = [
        // Hostname loopback
        'http://localhost/admin',
        'http://api.localhost/v1',
        'http://localhost./admin',
        // IPv4 loopback (including integer/hex/octal encodings normalized by WHATWG URL)
        'http://127.0.0.1:8080/secret',
        'http://127.255.255.254/',
        'http://2130706433/',
        'http://0x7f000001/',
        // IPv4 unspecified
        'http://0.0.0.0/',
        'http://0.1.2.3/',
        // RFC1918 private networks
        'http://10.0.0.1/',
        'http://10.255.255.255/',
        'http://172.16.0.1/',
        'http://172.31.255.254/',
        'http://192.168.0.1/',
        'http://192.168.1.254/',
        // Link-local / cloud metadata (AWS/GCP/Azure)
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.0.1/',
        // CGNAT 100.64.0.0/10 including Alibaba Cloud ECS metadata 100.100.100.200
        'http://100.64.0.1/',
        'http://100.100.100.200/latest/meta-data/',
        'http://100.127.255.254/',
        // Multicast & reserved
        'http://224.0.0.1/',
        'http://239.255.255.250/',
        'http://240.0.0.1/',
        'http://255.255.255.255/',
        // IPv6 loopback, unspecified, link-local, ULA, multicast, and IPv4-mapped
        'http://[::1]:3000/',
        'http://[::]/',
        'http://[fe80::1]/',
        'http://[fe80::1%25eth0]/',
        'http://[fc00::1]/',
        'http://[fd12:3456:789a::1]/',
        'http://[ff02::1]/',
        'http://[::ffff:127.0.0.1]/',
        'http://[::ffff:100.100.100.200]/',
        'http://[::ffff:169.254.169.254]/',
        'http://[::ffff:93.184.216.34]/',
      ]

      for (const target of blockedUrls) {
        expect(() => validateOutboundUrl(target), `expected ${target} to be rejected`).toThrowError(
          expect.objectContaining({ kind: 'configuration', retryable: false }),
        )
      }

      // Boundary outside 100.64.0.0/10 and 172.16.0.0/12 must remain allowed
      expect(isBlockedIpAddress('100.63.255.255')).toBe(false)
      expect(isBlockedIpAddress('100.128.0.1')).toBe(false)
      expect(isBlockedIpAddress('172.15.255.255')).toBe(false)
      expect(isBlockedIpAddress('172.32.0.1')).toBe(false)
      expect(() => assertSafeIpAddress('100.100.100.200')).toThrowError(expect.objectContaining({ kind: 'configuration' }))
    })

    it('permits loopback when allowLoopback or E2E_DISPOSABLE_DATABASE=1 is active while still blocking metadata and RFC1918', () => {
      for (const mode of ['option', 'env'] as const) {
        if (mode === 'env') {
          vi.stubEnv('E2E_DISPOSABLE_DATABASE', '1')
        } else {
          vi.stubEnv('E2E_DISPOSABLE_DATABASE', '')
        }
        const opts = mode === 'option' ? { allowLoopback: true } : undefined

        expect(validateOutboundUrl('http://127.0.0.1:4567/rss', opts).hostname).toBe('127.0.0.1')
        expect(validateOutboundUrl('http://localhost:4567/v1/chat/completions', opts).hostname).toBe('localhost')
        expect(validateOutboundUrl('http://[::1]:4567/v1', opts).hostname).toBe('[::1]')

        for (const stillBlocked of [
          'http://169.254.169.254/latest/meta-data/',
          'http://100.100.100.200/latest/meta-data/',
          'http://100.64.0.1/',
          'http://10.0.0.1/',
          'http://172.16.0.1/',
          'http://192.168.1.1/',
          'http://0.0.0.0/',
          'http://[::]/',
          'http://[fe80::1]/',
          'http://[fc00::1]/',
          'http://[::ffff:100.100.100.200]/',
          'http://[::ffff:169.254.169.254]/',
        ]) {
          expect(() => validateOutboundUrl(stillBlocked, opts), `expected ${stillBlocked} to stay blocked in ${mode} mode`).toThrowError(
            expect.objectContaining({ kind: 'configuration', retryable: false }),
          )
        }
      }
    })
  })

  describe('DNS-validating lookup & real undici Agent dispatcher', () => {
    it('rejects DNS rebinding responses when any resolved record is private, metadata, or loopback', async () => {
      const fakeLookup = vi.fn((hostname: string, _opts: unknown, cb: (err: NodeJS.ErrnoException | null, addresses?: dns.LookupAddress[]) => void) => {
        if (hostname === 'mixed.rebind.test') {
          cb(null, [
            { address: '93.184.216.34', family: 4 },
            { address: '100.100.100.200', family: 4 },
          ])
          return
        }
        if (hostname === 'ecs-meta.rebind.test') {
          cb(null, [{ address: '100.100.100.200', family: 4 }])
          return
        }
        if (hostname === 'aws-meta.rebind.test') {
          cb(null, [{ address: '169.254.169.254', family: 4 }])
          return
        }
        cb(null, [{ address: '93.184.216.34', family: 4 }])
      }) as unknown as typeof dns.lookup

      const safeLookup = createSsrfSafeLookup({ lookupImpl: fakeLookup })

      const runLookup = (host: string, all = false) =>
        new Promise<{ address: unknown; family?: number }>((resolve, reject) => {
          safeLookup(host, { all }, (err, address, family) => {
            if (err) reject(err)
            else resolve({ address, family })
          })
        })

      await expect(runLookup('mixed.rebind.test', true)).rejects.toMatchObject({ kind: 'configuration' })
      await expect(runLookup('ecs-meta.rebind.test', false)).rejects.toMatchObject({ kind: 'configuration' })
      await expect(runLookup('aws-meta.rebind.test', false)).rejects.toMatchObject({ kind: 'configuration' })
      await expect(runLookup('public.example.test', false)).resolves.toEqual({ address: '93.184.216.34', family: 4 })
    })

    it('blocks DNS rebinding at socket connect time with real globalThis.fetch and permits loopback only when enabled', async () => {
      let serverHits = 0
      const server = http.createServer((_req, res) => {
        serverHits += 1
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.end('local-mock-ok')
      })
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
      const { port } = server.address() as AddressInfo

      const rebindLookup = ((_hostname: string, _opts: unknown, cb: (err: NodeJS.ErrnoException | null, addresses?: dns.LookupAddress[]) => void) => {
        cb(null, [{ address: '127.0.0.1', family: 4 }])
      }) as unknown as typeof dns.lookup

      const blockingAgent = createSsrfSafeAgent({ allowLoopback: false, lookupImpl: rebindLookup })
      const allowingAgent = createSsrfSafeAgent({ allowLoopback: true, lookupImpl: rebindLookup })

      try {
        await expect(
          safeOutboundFetch(`http://rebind.attacker.example:${port}/secret`, {}, { allowLoopback: false, dispatcher: blockingAgent }),
        ).rejects.toMatchObject({ kind: 'configuration', retryable: false })
        expect(serverHits).toBe(0)

        const okResponse = await safeOutboundFetch(
          `http://127.0.0.1:${port}/ok`,
          {},
          { allowLoopback: true, dispatcher: allowingAgent },
        )
        expect(okResponse.status).toBe(200)
        expect(await okResponse.text()).toBe('local-mock-ok')
        expect(serverHits).toBe(1)
      } finally {
        await blockingAgent?.close?.()
        await allowingAgent?.close?.()
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
    })
  })

  describe('safeOutboundFetch manual redirect validation & credential stripping', () => {
    it('blocks 302 redirects to 127.0.0.1, 169.254.169.254, 100.100.100.200, and [::1]', async () => {
      for (const internalTarget of [
        'http://127.0.0.1:8080/internal',
        'http://169.254.169.254/latest/meta-data/',
        'http://100.100.100.200/latest/meta-data/ram/security-credentials/',
        'http://[::1]:8080/internal',
      ]) {
        const fetchImpl = vi.fn<typeof fetch>(async () =>
          new Response(null, { status: 302, headers: { location: internalTarget } }),
        )

        await expect(
          safeOutboundFetch('https://public.example.com/start', { method: 'GET' }, { fetchImpl }),
        ).rejects.toMatchObject({ kind: 'configuration', retryable: false })
        expect(fetchImpl).toHaveBeenCalledTimes(1)
      }
    })

    it('strips Authorization and Cookie across origins while keeping same-origin headers', async () => {
      const responses = [
        new Response(null, { status: 302, headers: { location: '/same-origin-hop' } }),
        new Response(null, { status: 302, headers: { location: 'https://cdn.other.example/final' } }),
        new Response('ok', { status: 200 }),
      ]
      const fetchImpl = vi.fn<typeof fetch>(async () => responses.shift()!)

      const response = await safeOutboundFetch(
        'https://api.example.com/start',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer top-secret',
            Cookie: 'sid=cookie-secret',
            'X-Trace': 'trace-1',
          },
        },
        { fetchImpl },
      )

      expect(await response.text()).toBe('ok')
      expect(fetchImpl).toHaveBeenCalledTimes(3)
      const hop1Headers = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>
      expect(hop1Headers).toMatchObject({
        Authorization: 'Bearer top-secret',
        Cookie: 'sid=cookie-secret',
        'X-Trace': 'trace-1',
      })
      const hop2Headers = fetchImpl.mock.calls[2]?.[1]?.headers as Record<string, string>
      expect(hop2Headers).not.toHaveProperty('Authorization')
      expect(hop2Headers).not.toHaveProperty('Cookie')
      expect(hop2Headers).toHaveProperty('X-Trace', 'trace-1')
    })
  })
})
