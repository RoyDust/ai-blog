import { cache } from "react";
import { getServerSession } from "next-auth";

import type { RouteSession } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { buildLoginPromptPath } from "@/lib/login-redirect";

const readAdminServerSession = cache(async () => {
  try {
    return await getServerSession(authOptions);
  } catch (error) {
    if (error instanceof Error && error.message === "Session user no longer exists") {
      return null;
    }
    throw error;
  }
});

/**
 * 后台服务端页面统一使用的实时管理员会话校验（请求级去重）。
 *
 * 背景：
 * - middleware 仅做无状态 JWT 解码，不访问 PostgreSQL；
 * - App Router 客户端切页只拉取目标 page.tsx 的 RSC payload，不重跑 admin/layout.tsx；
 * - getServerSession(authOptions) 会触发 authOptions.callbacks.jwt 实时查库刷新 role 并拦截已删除账号。
 */
export const requireAdminPageSession: (callbackUrl?: string) => Promise<RouteSession> = cache(
  async (callbackUrl = "/admin"): Promise<RouteSession> => {
    const session = await readAdminServerSession();

    if (!session?.user?.id) {
      const target = buildLoginPromptPath({ callbackUrl });
      const { redirect } = await import("next/navigation");
      redirect(target);
      throw new Error(`NEXT_REDIRECT:${target}`);
    }

    if (session.user.role !== "ADMIN") {
      const target = buildLoginPromptPath({ callbackUrl, error: "not-admin" });
      const { redirect } = await import("next/navigation");
      redirect(target);
      throw new Error(`NEXT_REDIRECT:${target}`);
    }

    return session as RouteSession;
  },
);
