import { findDatabaseUrl } from './database-url'
import { isPlaceholderAuthSecret } from './auth-secret'

type WebEnvironment = Partial<
  Record<
    'DATABASE_URL' | 'AUTH_SECRET' | 'NEXTAUTH_SECRET' | 'NEXTAUTH_URL' | 'NEXT_PUBLIC_SITE_URL' | 'NODE_ENV',
    string
  >
>

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function isUrl(value: string | undefined, protocols: string[]) {
  try {
    const url = new URL(value?.trim() ?? '')
    return protocols.includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

function isAllowedSiteUrl(value: string | undefined, nodeEnv: string | undefined) {
  try {
    const url = new URL(value?.trim() ?? '')
    if (!url.hostname) return false
    if (url.protocol === 'https:') return true
    if (url.protocol === 'http:') {
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
  if (
    !isUrl(env.DATABASE_URL, ['postgres:', 'postgresql:']) ||
    secrets.some((value) => !value?.trim() || isPlaceholderAuthSecret(value)) ||
    !isAllowedSiteUrl(env.NEXTAUTH_URL, env.NODE_ENV) ||
    !isAllowedSiteUrl(env.NEXT_PUBLIC_SITE_URL, env.NODE_ENV)
  ) {
    errors.push('configuration_invalid')
  }
  return { valid: errors.length === 0, errors }
}

export function getWebReadinessConfig() {
  return parseWebReadinessConfig({ ...process.env, DATABASE_URL: findDatabaseUrl() })
}
