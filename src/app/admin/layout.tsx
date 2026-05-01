import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminLayout } from "@/components/admin/shell/AdminLayout";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fadmin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/login?error=not-admin&callbackUrl=%2Fadmin");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      image: true,
      name: true,
      role: true,
    },
  });

  const user = {
    email: currentUser?.email ?? session.user.email,
    image: currentUser?.image ?? session.user.image ?? null,
    label: currentUser?.name || currentUser?.email || session.user.name || session.user.email || "Admin",
    role: currentUser?.role ?? session.user.role,
  };

  return <AdminLayout user={user}>{children}</AdminLayout>;
}
