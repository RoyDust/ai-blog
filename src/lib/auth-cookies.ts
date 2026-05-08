type AuthCookieEnv = Partial<Record<"NEXTAUTH_URL" | "NEXT_PUBLIC_SITE_URL" | "SITE_URL" | "NODE_ENV", string>>;

export const authSessionCookieName = "next-auth.session-token";

export function shouldUseSecureAuthCookies(env: AuthCookieEnv = process.env) {
  const configuredUrl = env.NEXTAUTH_URL || env.NEXT_PUBLIC_SITE_URL || env.SITE_URL;

  if (configuredUrl) {
    try {
      return new URL(configuredUrl).protocol === "https:";
    } catch {
      return env.NODE_ENV === "production";
    }
  }

  return env.NODE_ENV === "production";
}
