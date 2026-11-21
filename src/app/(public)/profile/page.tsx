export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Masthead, Reveal, TextLink } from "@/components/editorial";
import { authOptions } from "@/lib/auth";
import { getBlogSettings } from "@/lib/blog-settings";
import { buildLoginPromptPath } from "@/lib/login-redirect";
import { prisma } from "@/lib/prisma";
import { buildNoIndexMetadata } from "@/lib/seo";

import { ReaderProfileForm } from "./ReaderProfileForm";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildNoIndexMetadata({
    title: "个人资料",
    description: "查看并更新你的账号基础资料。",
    path: "/profile",
    siteUrl: settings.siteUrl,
  });
}

function formatJoinedDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return redirect(buildLoginPromptPath({ callbackUrl: "/profile" }));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    return redirect(buildLoginPromptPath({ callbackUrl: "/profile" }));
  }

  const isAdmin = user.role === "ADMIN";
  const roleSummary = isAdmin ? "管理员账号" : "读者账号";

  return (
    <div className="space-y-6" data-testid="reader-profile-page">
      <Reveal>
        <Masthead
          aside={
            isAdmin ? (
              <TextLink href="/admin/settings?tab=account">前往后台账号与站点设置</TextLink>
            ) : undefined
          }
          description="查看当前账号的身份与注册邮箱，并更新你的显示名称、登录邮箱与头像链接。"
          eyebrow="账号"
          meta={`${roleSummary} · ${user.email}`}
          title="个人资料"
        />
      </Reveal>

      <Reveal delay={0.06}>
        <ReaderProfileForm
          user={{
            id: user.id,
            name: user.name ?? "",
            email: user.email,
            image: user.image ?? "",
            role: user.role,
            joinedDate: formatJoinedDate(user.createdAt),
          }}
        />
      </Reveal>
    </div>
  );
}
