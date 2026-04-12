import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminLayout } from "@/components/admin/shell/AdminLayout";
import { authOptions } from "@/lib/auth";

export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fadmin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/login?error=not-admin&callbackUrl=%2Fadmin");
  }

  const userLabel = session.user.name || session.user.email || "Admin";

  return <AdminLayout userLabel={userLabel}>{children}</AdminLayout>;
}
