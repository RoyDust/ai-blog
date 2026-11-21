import { cache } from "react";

import { getBlogSettings } from "@/lib/blog-settings";
import { mergePublicProfileUser, type PublicProfile } from "@/lib/public-profile-data";

const SYNTHETIC_ADMIN_EXCLUSION = [
  { email: { endsWith: ".local" } },
  { email: { endsWith: ".test" } },
  { name: { in: ["E2E Admin", "Codex Browser Test"] } },
];

async function readPublicProfile(): Promise<PublicProfile> {
  const settings = await getBlogSettings();

  try {
    const { prisma } = await import("@/lib/prisma");
    const primaryAdmin = await prisma.user.findFirst({
      where: {
        role: "ADMIN",
        NOT: SYNTHETIC_ADMIN_EXCLUSION,
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        name: true,
        image: true,
      },
    });

    const user =
      primaryAdmin ??
      (await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: [{ createdAt: "asc" }],
        select: {
          name: true,
          image: true,
        },
      }));

    return mergePublicProfileUser(user, settings.profile);
  } catch {
    return mergePublicProfileUser(null, settings.profile);
  }
}

/**
 * 读取前台公开作者资料，请求级去重。
 *
 * 仅读取管理员公开展示所需的昵称与头像，公开邮箱只取显式公开配置或
 * NEXT_PUBLIC_CONTACT_EMAIL，绝不回退暴露管理员登录表 User.email。
 */
export const getPublicProfile: () => Promise<PublicProfile> = cache(readPublicProfile);
