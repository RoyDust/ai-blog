import { getServerSession } from "next-auth";
import { AdminSettingsClient } from "@/components/admin/settings/AdminSettingsClient";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/seo";

const fallbackUser = {
  id: "unknown",
  name: "Admin",
  email: "admin@example.com",
  image: null,
  role: "ADMIN",
  githubLinked: false,
};

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          accounts: {
            where: { provider: "github" },
            select: { providerAccountId: true },
          },
        },
      })
    : null;

  const settingsUser = user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        githubLinked: (user.accounts?.length ?? 0) > 0,
      }
    : fallbackUser;

  return (
    <AdminSettingsClient
      blogSettings={{
        siteName: "roydust.top",
        siteDescription: "一个基于 Next.js 构建的现代化博客系统。",
        siteUrl: getSiteUrl(),
        locale: "zh-CN",
      }}
      user={settingsUser}
    />
  );
}
