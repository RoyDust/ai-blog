import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminLayout } from "@/components/admin/shell/AdminLayout";
import { authOptions } from "@/lib/auth";
import { getBlogSettings } from "@/lib/blog-settings";
import { buildLoginPromptPath } from "@/lib/login-redirect";
import { prisma } from "@/lib/prisma";

export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(buildLoginPromptPath({ callbackUrl: "/admin" }));
  }

  if (session.user.role !== "ADMIN") {
    redirect(buildLoginPromptPath({ callbackUrl: "/admin", error: "not-admin" }));
  }

  const [currentUser, blogSettings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        image: true,
        name: true,
        role: true,
      },
    }),
    getBlogSettings(),
  ]);

  const user = {
    email: currentUser?.email ?? session.user.email,
    image: currentUser?.image ?? session.user.image ?? null,
    label: currentUser?.name || currentUser?.email || session.user.name || session.user.email || "Admin",
    role: currentUser?.role ?? session.user.role,
  };

  return (
    <AdminLayout siteName={blogSettings.siteName} user={user}>
      {children}
    </AdminLayout>
  );
}
