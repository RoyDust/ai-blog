import { AdminSettingsClient } from "@/components/admin/settings/AdminSettingsClient";
import { requireAdminPageSession } from "@/lib/admin-page-auth";
import { getApiOperationLogSettingsSummary } from "@/lib/api-operation-log-settings";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";

const fallbackUser = {
  id: "unknown",
  name: "Admin",
  email: "admin@example.com",
  image: null,
  role: "ADMIN",
  githubLinked: false,
};

export default async function AdminSettingsPage() {
  const session = await requireAdminPageSession();
  const [operationLogSettings, blogSettings, user] = await Promise.all([
    getApiOperationLogSettingsSummary(),
    getBlogSettings(),
    prisma.user.findUnique({
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
    }),
  ]);

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
      blogSettings={blogSettings}
      operationLogSettings={operationLogSettings}
      user={settingsUser}
    />
  );
}
