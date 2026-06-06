import { getBlogSettings } from "@/lib/blog-settings";
import { mergePublicProfileUser } from "@/lib/public-profile-data";

export async function getPublicProfile() {
  const settings = await getBlogSettings();

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

    return mergePublicProfileUser(user, settings.profile);
  } catch {
    return mergePublicProfileUser(null, settings.profile);
  }
}
