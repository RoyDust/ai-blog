import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeOrigin(value: string | undefined | null) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isAllowedOrigin(origin: string | null, requestUrl: string) {
  const allowedOrigins = [
    normalizeOrigin(requestUrl),
    normalizeOrigin(process.env.NEXTAUTH_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
  ].filter((value): value is string => Boolean(value));

  return !!origin && allowedOrigins.includes(origin);
}

/**
 * 解除当前用户的 GitHub 账号绑定。
 *
 * 安全约束：
 * - 必须登录
 * - 必须来自同源 Origin
 * - 解绑后必须仍保留至少一种登录方式，避免用户把自己锁死
 */
export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const requestOrigin = headerStore.get("origin");

    if (!isAllowedOrigin(requestOrigin, request.url)) {
      return NextResponse.json({ error: "非法请求来源" }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const [user, githubAccount, otherAccountsCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      }),
      prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "github",
        },
        select: { id: true },
      }),
      prisma.account.count({
        where: {
          userId: session.user.id,
          provider: { not: "github" },
        },
      }),
    ]);

    if (!githubAccount) {
      return NextResponse.json({ error: "未绑定 GitHub 账号" }, { status: 400 });
    }

    if (!user?.password && otherAccountsCount === 0) {
      return NextResponse.json(
        { error: "解绑后你将无法登录，请先设置密码或绑定其他登录方式" },
        { status: 400 },
      );
    }

    await prisma.account.delete({
      where: { id: githubAccount.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
