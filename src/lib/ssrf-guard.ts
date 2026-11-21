import * as dns from 'node:dns'
import {
  ReliabilityError,
  cancelResponseBody,
  getResponseHeader,
  isAbortError,
  normalizeTransportError,
} from './external-reliability'

export interface SsrfGuardOptions {
  allowLoopback?: boolean
}

export interface OutboundDispatcherLike {
  close?: () => Promise<void>
}

export interface CreateSsrfSafeAgentOptions extends SsrfGuardOptions {
  lookupImpl?: typeof dns.lookup
}

export interface SafeOutboundFetchOptions extends SsrfGuardOptions {
  fetchImpl?: typeof fetch
  maxRedirects?: number
  secrets?: readonly string[]
  dispatcher?: OutboundDispatcherLike | null
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const CREDENTIAL_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key', 'x-auth-token'])
const BODY_HEADERS_ON_GET_REDIRECT = new Set(['content-type', 'content-length', 'transfer-encoding'])
const UNDICI_GLOBAL_DISPATCHER_SYMBOL = Symbol.for('undici.globalDispatcher.1')

type UndiciAgentConstructor = new (options: {
  connect?: {
    lookup?: ReturnType<typeof createSsrfSafeLookup>
  }
}) => OutboundDispatcherLike

let cachedAgentCtor: UndiciAgentConstructor | null = null
let defaultBlockingAgent: OutboundDispatcherLike | null = null
let defaultLoopbackAgent: OutboundDispatcherLike | null = null

export function isOutboundLoopbackAllowed(options?: SsrfGuardOptions): boolean {
  if (typeof options?.allowLoopback === 'boolean') {
    return options.allowLoopback
  }
  return process.env.E2E_DISPOSABLE_DATABASE === '1'
}

export function parseIpv4Octets(value: string): [number, number, number, number] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return null
  }
  const parts = value.split('.')
  if (parts.length !== 4) {
    return null
  }
  const octets: number[] = []
  for (const part of parts) {
    if (part.length > 1 && part.startsWith('0')) {
      return null
    }
    const num = Number(part)
    if (!Number.isInteger(num) || num < 0 || num > 255) {
      return null
    }
    octets.push(num)
  }
  return [octets[0]!, octets[1]!, octets[2]!, octets[3]!]
}

function parseHextetList(segment: string): number[] | null {
  if (segment === '') {
    return []
  }
  const parts = segment.split(':')
  const words: number[] = []
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) {
      return null
    }
    words.push(Number.parseInt(part, 16))
  }
  return words
}

export function parseIpv6Words(rawValue: string): number[] | null {
  const unbracketed = rawValue.startsWith('[') && rawValue.endsWith(']')
    ? rawValue.slice(1, -1)
    : rawValue
  if (!unbracketed.includes(':')) {
    return null
  }
  let addr = unbracketed.toLowerCase()
  if (addr.includes('.')) {
    const lastColon = addr.lastIndexOf(':')
    if (lastColon < 0) {
      return null
    }
    const octets = parseIpv4Octets(addr.slice(lastColon + 1))
    if (!octets) {
      return null
    }
    const hi = ((octets[0] << 8) | octets[1]).toString(16)
    const lo = ((octets[2] << 8) | octets[3]).toString(16)
    const prefix = addr.slice(0, lastColon + 1)
    addr = prefix.endsWith('::') ? `${prefix}${hi}:${lo}` : `${addr.slice(0, lastColon)}:${hi}:${lo}`
  }

  const doubleColonParts = addr.split('::')
  if (doubleColonParts.length > 2) {
    return null
  }
  if (doubleColonParts.length === 2) {
    const left = parseHextetList(doubleColonParts[0]!)
    const right = parseHextetList(doubleColonParts[1]!)
    if (!left || !right || left.length + right.length >= 8) {
      return null
    }
    const missing = 8 - left.length - right.length
    return [...left, ...Array<number>(missing).fill(0), ...right]
  }

  const full = parseHextetList(doubleColonParts[0]!)
  if (!full || full.length !== 8) {
    return null
  }
  return full
}

function classifyIpv4Octets(
  [a, b]: [number, number, number, number],
  allowLoopback: boolean,
): string | null {
  // 0.0.0.0/8 (unspecified / "this network")
  if (a === 0) return 'unspecified'
  // 127.0.0.0/8 (loopback)
  if (a === 127) return allowLoopback ? null : 'loopback'
  // 10.0.0.0/8 (RFC1918)
  if (a === 10) return 'private-rfc1918'
  // 172.16.0.0/12 (RFC1918)
  if (a === 172 && b >= 16 && b <= 31) return 'private-rfc1918'
  // 192.168.0.0/16 (RFC1918)
  if (a === 192 && b === 168) return 'private-rfc1918'
  // 169.254.0.0/16 (link-local & AWS/GCP/Azure metadata 169.254.169.254)
  if (a === 169 && b === 254) return 'link-local'
  // 100.64.0.0/10 (CGNAT & Alibaba Cloud ECS metadata 100.100.100.200)
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat-metadata'
  // 198.18.0.0/15 (benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return 'benchmark'
  // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved / broadcast)
  if (a >= 224) return 'multicast-or-reserved'
  return null
}

function wordsAreZero(words: number[], endExclusive: number): boolean {
  for (let index = 0; index < endExclusive; index += 1) {
    if (words[index] !== 0) return false
  }
  return true
}

function extractOctetsFromWordPair(hiWord: number, loWord: number): [number, number, number, number] {
  return [(hiWord >> 8) & 0xff, hiWord & 0xff, (loWord >> 8) & 0xff, loWord & 0xff]
}

function isIpv4TransitionPrefix(words: number[]): boolean {
  if (wordsAreZero(words, 4) && words[4] === 0xffff && words[5] === 0) {
    return true
  }
  if (words[0] !== 0x0064 || words[1] !== 0xff9b) {
    return false
  }
  return (words[2] === 0 && words[3] === 0 && words[4] === 0 && words[5] === 0) || words[2] === 0x0001
}

function classifyHighIpv6Prefix(w0: number): string | null {
  if ((w0 & 0xfe00) === 0xfc00) return 'ipv6-ula'
  if ((w0 & 0xffc0) === 0xfe80) return 'ipv6-link-local'
  if ((w0 & 0xffc0) === 0xfec0) return 'ipv6-site-local'
  if ((w0 & 0xff00) === 0xff00) return 'ipv6-multicast'
  return null
}

function classifyIpv6Words(words: number[], allowLoopback: boolean): string | null {
  if (wordsAreZero(words, 8)) return 'unspecified'
  if (wordsAreZero(words, 7) && words[7] === 1) {
    return allowLoopback ? null : 'loopback'
  }
  // ::ffff:0:0/96 (IPv4-mapped IPv6)
  if (wordsAreZero(words, 5) && words[5] === 0xffff) {
    const mapped = extractOctetsFromWordPair(words[6]!, words[7]!)
    const v4Reason = classifyIpv4Octets(mapped, allowLoopback)
    if (v4Reason) return v4Reason
    return allowLoopback && mapped[0] === 127 ? null : 'ipv4-mapped'
  }
  if (wordsAreZero(words, 6)) return 'ipv4-compatible'
  if (isIpv4TransitionPrefix(words)) return 'ipv4-transition'
  if (words[0] === 0x2002) {
    const v4Reason = classifyIpv4Octets(extractOctetsFromWordPair(words[1]!, words[2]!), allowLoopback)
    if (v4Reason) return v4Reason
  }
  return classifyHighIpv6Prefix(words[0]!)
}

function classifyIpAddress(rawIp: string, allowLoopback: boolean): string | null {
  const trimmed = rawIp.trim()
  if (!trimmed) return 'invalid-ip'
  const unbracketed = trimmed.startsWith('[') && trimmed.endsWith(']')
    ? trimmed.slice(1, -1)
    : trimmed

  if (unbracketed.includes('%')) {
    return 'ipv6-scoped'
  }

  const v4 = parseIpv4Octets(unbracketed)
  if (v4) {
    return classifyIpv4Octets(v4, allowLoopback)
  }

  const v6 = parseIpv6Words(unbracketed)
  if (v6) {
    return classifyIpv6Words(v6, allowLoopback)
  }

  return null
}

function isIpLiteral(value: string): boolean {
  const unbracketed = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
  const withoutZone = unbracketed.split('%', 1)[0] ?? unbracketed
  return parseIpv4Octets(withoutZone) !== null || parseIpv6Words(withoutZone) !== null
}

export function isBlockedIpAddress(ip: string, options?: SsrfGuardOptions): boolean {
  const trimmed = ip.trim()
  if (!trimmed || !isIpLiteral(trimmed)) {
    return true
  }
  return classifyIpAddress(trimmed, isOutboundLoopbackAllowed(options)) !== null
}

function createBlockedAddressError(reason: string, secrets?: readonly string[]): ReliabilityError & { code: string } {
  return Object.assign(
    new ReliabilityError({
      kind: 'configuration',
      retryable: false,
      message: `Outbound request blocked by SSRF policy (${reason}; invalid URL target)`,
      secrets,
    }),
    { code: 'ERR_INVALID_URL' },
  )
}

export function assertSafeIpAddress(ip: string, options?: SsrfGuardOptions & { secrets?: readonly string[] }): void {
  const trimmed = ip.trim()
  if (!trimmed || !isIpLiteral(trimmed)) {
    throw createBlockedAddressError('invalid-ip', options?.secrets)
  }
  const reason = classifyIpAddress(trimmed, isOutboundLoopbackAllowed(options))
  if (reason !== null) {
    throw createBlockedAddressError(reason, options?.secrets)
  }
}

function validateBracketedIpv6Host(
  rawHostname: string,
  allowLoopback: boolean,
  secrets?: readonly string[],
): void {
  if (!rawHostname.startsWith('[') || !rawHostname.endsWith(']')) {
    throw createBlockedAddressError('malformed-ipv6', secrets)
  }
  const inner = rawHostname.slice(1, -1)
  if (inner.includes('%')) {
    throw createBlockedAddressError('ipv6-scoped', secrets)
  }
  const words = parseIpv6Words(inner)
  if (!words) {
    throw createBlockedAddressError('malformed-ipv6', secrets)
  }
  const reason = classifyIpv6Words(words, allowLoopback)
  if (reason !== null) {
    throw createBlockedAddressError(reason, secrets)
  }
}

function validateUrlHostname(
  rawHostname: string,
  allowLoopback: boolean,
  secrets?: readonly string[],
): void {
  if (!rawHostname) {
    throw createBlockedAddressError('empty-hostname', secrets)
  }
  if (rawHostname.startsWith('[') || rawHostname.endsWith(']')) {
    validateBracketedIpv6Host(rawHostname, allowLoopback, secrets)
    return
  }
  const cleanHost = rawHostname.replace(/\.+$/, '')
  if (!cleanHost) {
    throw createBlockedAddressError('empty-hostname', secrets)
  }
  if (cleanHost === 'localhost' || cleanHost.endsWith('.localhost')) {
    if (!allowLoopback) {
      throw createBlockedAddressError('loopback-hostname', secrets)
    }
    return
  }
  const v4 = parseIpv4Octets(cleanHost)
  if (v4) {
    const reason = classifyIpv4Octets(v4, allowLoopback)
    if (reason !== null) {
      throw createBlockedAddressError(reason, secrets)
    }
    return
  }
  if (/^\d+(?:\.\d+)*$/.test(cleanHost)) {
    throw createBlockedAddressError('malformed-ipv4', secrets)
  }
}

export function validateOutboundUrl(
  input: string | URL,
  options?: SsrfGuardOptions & { secrets?: readonly string[]; invalidMessage?: string; credentialMessage?: string },
): URL {
  let url: URL
  try {
    url = input instanceof URL ? new URL(input.toString()) : new URL(input)
  } catch {
    throw new ReliabilityError({
      kind: 'configuration',
      retryable: false,
      message: options?.invalidMessage ?? 'Outbound URL is invalid',
      secrets: options?.secrets,
    })
  }

  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new ReliabilityError({
      kind: 'configuration',
      retryable: false,
      message: options?.credentialMessage ?? 'Outbound URL must be HTTP(S) without credentials',
      secrets: options?.secrets,
    })
  }

  validateUrlHostname(url.hostname.toLowerCase(), isOutboundLoopbackAllowed(options), options?.secrets)
  return url
}

export function createSsrfSafeLookup(options: CreateSsrfSafeAgentOptions = {}) {
  const lookupFn = options.lookupImpl ?? dns.lookup
  return (
    hostname: string,
    lookupOptions: dns.LookupOptions | number | undefined,
    callback: (
      err: NodeJS.ErrnoException | null,
      address?: string | dns.LookupAddress[],
      family?: number,
    ) => void,
  ): void => {
    const allowLoopback = isOutboundLoopbackAllowed(options)
    const cleanHost = hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase()

    if (!allowLoopback && (cleanHost === 'localhost' || cleanHost.endsWith('.localhost'))) {
      callback(createBlockedAddressError('loopback-hostname'))
      return
    }

    if (isIpLiteral(cleanHost)) {
      const reason = classifyIpAddress(cleanHost, allowLoopback)
      if (reason !== null) {
        callback(createBlockedAddressError(reason))
        return
      }
    }

    const wantAll = typeof lookupOptions === 'object' && lookupOptions !== null && Boolean(lookupOptions.all)
    const family = typeof lookupOptions === 'number'
      ? lookupOptions
      : lookupOptions?.family
    const normalizedOptions: dns.LookupAllOptions = {
      ...(typeof lookupOptions === 'object' && lookupOptions !== null ? lookupOptions : {}),
      ...(family !== undefined ? { family } : {}),
      all: true,
      verbatim: true,
    }

    lookupFn(hostname, normalizedOptions, (err, addresses) => {
      if (err) {
        callback(err)
        return
      }
      const list = Array.isArray(addresses) ? addresses : []
      if (list.length === 0) {
        const notFound: NodeJS.ErrnoException = Object.assign(new Error(`queryA ENOTFOUND ${hostname}`), {
          code: 'ENOTFOUND',
        })
        callback(notFound)
        return
      }
      for (const entry of list) {
        const reason = classifyIpAddress(entry.address, allowLoopback)
        if (reason !== null) {
          callback(createBlockedAddressError(reason))
          return
        }
      }
      if (wantAll) {
        callback(null, list)
        return
      }
      const first = list[0]!
      callback(null, first.address, first.family)
    })
  }
}

function isMockFetchFunction(fn: unknown): boolean {
  if (typeof fn !== 'function') return false
  return 'mock' in fn || Boolean((fn as { _isMockFunction?: unknown })._isMockFunction)
}

function resolveUndiciAgentConstructor(): UndiciAgentConstructor | null {
  if (cachedAgentCtor) {
    return cachedAgentCtor
  }
  const readGlobalAgentCtor = (): UndiciAgentConstructor | null => {
    const dispatcher = (globalThis as Record<symbol, unknown>)[UNDICI_GLOBAL_DISPATCHER_SYMBOL]
    if (
      dispatcher &&
      typeof dispatcher === 'object' &&
      typeof (dispatcher as { constructor?: unknown }).constructor === 'function' &&
      dispatcher.constructor.name === 'Agent'
    ) {
      return dispatcher.constructor as unknown as UndiciAgentConstructor
    }
    return null
  }

  const existing = readGlobalAgentCtor()
  if (existing) {
    cachedAgentCtor = existing
    return existing
  }

  if (typeof globalThis.fetch === 'function' && !isMockFetchFunction(globalThis.fetch)) {
    const controller = new AbortController()
    controller.abort()
    try {
      globalThis.fetch('http://invalid.invalid', { signal: controller.signal }).catch(() => {})
    } catch {
      // Aborted synchronous initialization only registers Node's built-in undici globalDispatcher.
    }
    const initialized = readGlobalAgentCtor()
    if (initialized) {
      cachedAgentCtor = initialized
      return initialized
    }
  }

  return null
}

export function createSsrfSafeAgent(options: CreateSsrfSafeAgentOptions = {}): OutboundDispatcherLike | null {
  const AgentCtor = resolveUndiciAgentConstructor()
  if (!AgentCtor) {
    return null
  }
  return new AgentCtor({
    connect: {
      lookup: createSsrfSafeLookup(options),
    },
  })
}

export function getSsrfSafeDispatcher(options?: SsrfGuardOptions): OutboundDispatcherLike | null {
  const allowLoopback = isOutboundLoopbackAllowed(options)
  if (allowLoopback) {
    if (!defaultLoopbackAgent) {
      defaultLoopbackAgent = createSsrfSafeAgent({ allowLoopback: true })
    }
    return defaultLoopbackAgent
  }
  if (!defaultBlockingAgent) {
    defaultBlockingAgent = createSsrfSafeAgent({ allowLoopback: false })
  }
  return defaultBlockingAgent
}

function unwrapBlockedTransportError(error: unknown): ReliabilityError | null {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof ReliabilityError) {
      return current
    }
    current = typeof current === 'object' && current !== null ? (current as { cause?: unknown }).cause : undefined
  }
  return null
}

export async function executeOutboundFetchHop(
  url: URL,
  init: RequestInit,
  options: SafeOutboundFetchOptions = {},
): Promise<Response> {
  const customFetch = options.fetchImpl
  const effectiveFetch = customFetch ?? globalThis.fetch
  const useDispatcher =
    options.dispatcher !== undefined
      ? options.dispatcher
      : (customFetch === undefined || customFetch === globalThis.fetch) && !isMockFetchFunction(effectiveFetch)
        ? getSsrfSafeDispatcher(options)
        : null

  const requestInit: RequestInit & { dispatcher?: OutboundDispatcherLike } = {
    ...init,
    redirect: 'manual',
    ...(useDispatcher ? { dispatcher: useDispatcher } : {}),
  }

  try {
    return await effectiveFetch(url.toString(), requestInit)
  } catch (error) {
    const blocked = unwrapBlockedTransportError(error)
    if (blocked) {
      throw blocked
    }
    throw error
  }
}

function normalizeHeadersRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    const out: Record<string, string> = {}
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return { ...headers }
}

export function stripCrossOriginCredentialHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !CREDENTIAL_HEADERS.has(name.toLowerCase())),
  )
}

function stripRedirectBodyHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !BODY_HEADERS_ON_GET_REDIRECT.has(name.toLowerCase())),
  )
}

function isResponseLike(value: unknown): value is Response {
  return Boolean(value && typeof value === 'object' && typeof (value as { ok?: unknown }).ok === 'boolean')
}

export async function safeOutboundFetch(
  input: string | URL,
  init: RequestInit = {},
  options: SafeOutboundFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 10) {
    throw new ReliabilityError({
      kind: 'configuration',
      retryable: false,
      message: 'Outbound redirect policy is invalid',
      secrets: options.secrets,
    })
  }

  let currentUrl = validateOutboundUrl(input, options)
  let method = (init.method ?? 'GET').toUpperCase()
  let body = init.body
  let headers = normalizeHeadersRecord(init.headers)

  for (let redirect = 0; ; redirect += 1) {
    let response: Response
    try {
      response = await executeOutboundFetchHop(
        currentUrl,
        {
          ...init,
          method,
          headers,
          body,
          redirect: 'manual',
        },
        options,
      )
    } catch (error) {
      if (error instanceof ReliabilityError || isAbortError(error)) {
        throw error
      }
      throw normalizeTransportError(error, { secrets: options.secrets })
    }

    if (!isResponseLike(response)) {
      throw new ReliabilityError({
        kind: 'invalid-response',
        retryable: false,
        message: 'Outbound transport returned an invalid response',
        secrets: options.secrets,
      })
    }

    if (typeof response.status === 'number' && REDIRECT_STATUSES.has(response.status)) {
      if (redirect >= maxRedirects) {
        await cancelResponseBody(response)
        throw new ReliabilityError({
          kind: 'upstream-rejected',
          retryable: false,
          status: response.status,
          message: 'Outbound redirect limit exceeded',
          secrets: options.secrets,
        })
      }

      const location = getResponseHeader(response, 'location')
      if (!location) {
        await cancelResponseBody(response)
        throw new ReliabilityError({
          kind: 'invalid-response',
          retryable: false,
          status: response.status,
          message: 'Outbound redirect location is missing',
          secrets: options.secrets,
        })
      }

      let nextUrl: URL
      try {
        nextUrl = new URL(location, currentUrl)
      } catch {
        await cancelResponseBody(response)
        throw new ReliabilityError({
          kind: 'invalid-response',
          retryable: false,
          status: response.status,
          message: 'Outbound redirect URL is invalid',
          secrets: options.secrets,
        })
      }

      try {
        validateOutboundUrl(nextUrl, options)
      } catch (error) {
        await cancelResponseBody(response)
        throw error
      }

      if (nextUrl.origin !== currentUrl.origin) {
        headers = stripCrossOriginCredentialHeaders(headers)
      }

      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
        method = 'GET'
        body = undefined
        headers = stripRedirectBodyHeaders(headers)
      }

      await cancelResponseBody(response)
      currentUrl = nextUrl
      continue
    }

    return response
  }
}
