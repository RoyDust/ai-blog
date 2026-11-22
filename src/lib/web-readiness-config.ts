import { findDatabaseUrl } from './database-url'
import { isPlaceholderAuthSecret } from './auth-secret'

type WebEnvironment = Partial<
  Record<
    | 'DATABASE_URL'
    | 'AUTH_SECRET'
    | 'NEXTAUTH_SECRET'
    | 'NEXTAUTH_URL'
    | 'NEXT_PUBLIC_SITE_URL'
    | 'NODE_ENV'
    | 'ALLOW_INSECURE_HTTP_SITE_URL',
    string
  >
>

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function isTruthyFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

function isUrl(value: string | undefined, protocols: string[]) {
  try {
    const url = new URL(value?.trim() ?? '')
    return protocols.includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

function isAllowedSiteUrl(
  value: string | undefined,
  nodeEnv: string | undefined,
  allowInsecureHttp: boolean,
) {
  try {
    const url = new URL(value?.trim() ?? '')
    if (!url.hostname) return false
    if (url.protocol === 'https:') return true
    if (url.protocol === 'http:') {
      if (allowInsecureHttp) return true
      const normalizedNodeEnv = nodeEnv?.trim()
      return (
        LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase()) ||
        normalizedNodeEnv === 'development' ||
        normalizedNodeEnv === 'test'
      )
    }
    return false
  } catch {
    return false
  }
}

/** Pure policy shared by request readiness and the image preflight adapter. */
export function parseWebReadinessConfig(env: WebEnvironment) {
  const errors: Array<'configuration_invalid'> = []
  const secrets = [env.AUTH_SECRET, env.NEXTAUTH_SECRET]
  const allowInsecureHttp = isTruthyFlag(env.ALLOW_INSECURE_HTTP_SITE_URL)
  if (
    !isUrl(env.DATABASE_URL, ['postgres:', 'postgresql:']) ||
    secrets.some((value) => !value?.trim() || isPlaceholderAuthSecret(value)) ||
    !isAllowedSiteUrl(env.NEXTAUTH_URL, env.NODE_ENV, allowInsecureHttp) ||
    !isAllowedSiteUrl(env.NEXT_PUBLIC_SITE_URL, env.NODE_ENV, allowInsecureHttp)
  ) {
    errors.push('configuration_invalid')
  }
  return { valid: errors.length === 0, errors }
}

export function getWebReadinessConfig() {
  return parseWebReadinessConfig({ ...process.env, DATABASE_URL: findDatabaseUrl() })
}
