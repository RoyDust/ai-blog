import { redirect } from "next/navigation";

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/posts?tag=${encodeURIComponent(slug)}`);
}
