import { NextAuthOptions } from "next-auth"
import type { Adapter } from "next-auth/adapters"
import CredentialsProvider from "next-auth/providers/credentials"
import GitHubProvider from "next-auth/providers/github"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { requireAuthSecret, resolveAuthSecret } from "@/lib/auth-secret"
import bcrypt from "bcryptjs"

type AuthCookieEnv = Partial<Record<"NEXTAUTH_URL" | "NEXT_PUBLIC_SITE_URL" | "SITE_URL" | "NODE_ENV", string>>;

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

/**
 * NextAuth 服务端配置。
 *
 * 职责：
 * - 声明博客支持的登录方式（GitHub OAuth / 本地账号密码）
 * - 统一会话策略与 cookie 配置
 * - 在 JWT / Session 回调里补齐项目自定义字段（id、role）
 *
 * 说明：
 * - 本地账号登录会直接查询 Prisma 用户表并校验 bcrypt 密码
 * - 角色字段最终会进入 session.user.role，供 API 权限判断复用
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: resolveAuthSecret(),
  providers: [
    GitHubProvider({
      clientId: process.env.AUTH_GITHUB_ID || "",
      clientSecret: process.env.AUTH_GITHUB_SECRET || "",
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        requireAuthSecret()

        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.password) {
          throw new Error("Invalid credentials")
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error("Invalid credentials")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        secure: shouldUseSecureAuthCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60
      }
    }
  },
  callbacks: {
    /**
     * OAuth 登录前置校验。
     *
     * GitHub 登录需要可用邮箱，因为当前 User.email 是必填且唯一字段。
     * 不启用基于邮箱的危险自动合并；已存在本地账号时，用户应先登录后显式绑定 GitHub。
     */
    async signIn({ user, account }) {
      if (account?.provider === "github" && !user.email) {
        return "/login?error=GitHubEmailRequired"
      }

      return true
    },
    /**
     * 把数据库里的用户标识与角色写进 token，便于后续无状态鉴权。
     */
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? "USER"
      }
      if (account?.provider) {
        token.provider = account.provider
      }
      return token
    },
    /**
     * 把 token 中的自定义字段回填到 session，供页面与 API 统一消费。
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.provider = token.provider as string | undefined
      }
      return session
    }
  }
}
