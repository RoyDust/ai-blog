export function createSecurityHeaders(environment = process.env.NODE_ENV) {
  const scriptSrc = [
    "script-src 'self' 'unsafe-inline'",
    environment === 'production' ? null : "'unsafe-eval'",
  ].filter(Boolean).join(' ')

  // HSTS 只在生产返回；浏览器对纯 http 响应会忽略该头，因此提前配置无害，
  // 站点启用 TLS 后即自动生效。
  const productionOnlyHeaders =
    environment === 'production'
      ? [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ]
      : []

  return [
    ...productionOnlyHeaders,
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        // TODO(HTTPS 上线后，2026-08-15 核验)：图片主机 project.roydust.top 目前
        // 不提供 https（SSL 握手失败），因此暂不能启用 upgrade-insecure-requests，
        // 也不能把 img-src 收紧为纯 https。待该主机与站点整体启用 TLS 后：
        // 1) CSP 增加 "upgrade-insecure-requests"；
        // 2) img-src 收敛为 'self' https: data: blob:；
        // 3) NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL 切换 https，使会话 cookie 带 Secure。
        "img-src 'self' http: https: data: blob:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        scriptSrc,
        "connect-src 'self' https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
  ]
}

export const securityHeaders = createSecurityHeaders()
