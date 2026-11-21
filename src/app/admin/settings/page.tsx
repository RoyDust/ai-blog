import { getServerSession } from "next-auth";
import { AdminSettingsClient } from "@/components/admin/settings/AdminSettingsClient";
import { isSettingsTabId } from "@/components/admin/settings/settings-shared";
import { getApiOperationLogSettingsSummary } from "@/lib/api-operation-log-settings";
import { authOptions } from "@/lib/auth";
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

type SettingsSearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SettingsSearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSettingsPage({ searchParams }: { searchParams?: Promise<SettingsSearchParams> } = {}) {
  const params = (await searchParams) ?? {};
  const requestedTab = readParam(params, "tab");
  const githubJustLinked = readParam(params, "github") === "linked";
  // ?tab= 记住当前页签；GitHub 绑定回跳（?github=linked）落在账号资料页签
  const initialTab = isSettingsTabId(requestedTab) && !githubJustLinked ? requestedTab : "account";
  const session = await getServerSession(authOptions);
  const [operationLogSettings, blogSettings] = await Promise.all([
    getApiOperationLogSettingsSummary(),
    getBlogSettings(),
  ]);
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
      blogSettings={blogSettings}
      githubJustLinked={githubJustLinked}
      initialTab={initialTab}
      operationLogSettings={operationLogSettings}
      user={settingsUser}
    />
  );
}
