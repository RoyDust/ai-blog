import { unstable_noStore as noStore } from "next/cache";
import { mergePublicProfileUser } from "@/lib/public-profile-data";

export async function getPublicProfile() {
  noStore();

  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
      select: {
        name: true,
        email: true,
        image: true,
      },
    });

    return mergePublicProfileUser(user);
  } catch {
    return mergePublicProfileUser(null);
  }
}
