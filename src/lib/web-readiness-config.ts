import { findDatabaseUrl } from './database-url'
import { isPlaceholderAuthSecret } from './auth-secret'

type WebEnvironment = Partial<Record<'DATABASE_URL' | 'AUTH_SECRET' | 'NEXTAUTH_SECRET' | 'NEXTAUTH_URL' | 'NEXT_PUBLIC_SITE_URL', string>>
function isUrl(value: string | undefined, protocols: string[]) {
  try { const url = new URL(value?.trim() ?? ''); return protocols.includes(url.protocol) && Boolean(url.hostname) }
  catch { return false }
}

/** Pure policy shared by request readiness and the image preflight adapter. */
export function parseWebReadinessConfig(env: WebEnvironment) {
  const errors: Array<'configuration_invalid'> = []
  const secrets = [env.AUTH_SECRET, env.NEXTAUTH_SECRET]
  if (!isUrl(env.DATABASE_URL, ['postgres:', 'postgresql:']) ||
      secrets.some((value) => !value?.trim() || isPlaceholderAuthSecret(value)) ||
      !isUrl(env.NEXTAUTH_URL, ['http:', 'https:']) || !isUrl(env.NEXT_PUBLIC_SITE_URL, ['http:', 'https:'])) errors.push('configuration_invalid')
  return { valid: errors.length === 0, errors }
}

export function getWebReadinessConfig() {
  return parseWebReadinessConfig({ ...process.env, DATABASE_URL: findDatabaseUrl() })
}
