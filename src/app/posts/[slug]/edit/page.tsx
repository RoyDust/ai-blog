import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildLoginPromptPath } from "@/lib/login-redirect";
import { prisma } from "@/lib/prisma";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  const callbackUrl = `/posts/${slug}/edit`;

  if (!session?.user?.id) {
    return redirect(buildLoginPromptPath({ callbackUrl }));
  }

  if (session.user.role !== "ADMIN") {
    return redirect(buildLoginPromptPath({ callbackUrl, error: "not-admin" }));
  }

  const post = await prisma.post.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });

  if (!post) {
    return notFound();
  }

  return redirect(`/admin/posts/${post.id}/edit`);
}
