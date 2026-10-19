import { getToken } from "next-auth/jwt"
import { NextRequest } from "next/server"

import { authSessionCookieName } from "@/lib/auth-cookies"
import { resolveAuthSecret } from "@/lib/auth-secret"

/**
 * 直接解码请求里的 NextAuth 会话 JWT，取出登录用户 id。
 *
 * 与 getServerSession 的区别：不会触发 authOptions.jwt 回调，因此没有数据库查询；
 * 适合"登录态只是可选附加信息"的高频写路径（如页面浏览 beacon）。
 * 无 cookie、密钥缺失、解密 / 过期校验失败一律返回 null，不阻断调用方。
 * 需要以数据库为准的权限判断仍应走 requireSession / requireAdminSession。
 */
export async function readSessionUserId(request: Request): Promise<string | null> {
  const secret = resolveAuthSecret()

  if (!secret) {
    return null
  }

  try {
    const token = await getToken({
      req: new NextRequest(request.url, { headers: request.headers }),
      secret,
      cookieName: authSessionCookieName,
    })
    const userId = token?.id ?? token?.sub

    return typeof userId === "string" && userId.length > 0 ? userId : null
  } catch {
    return null
  }
}
