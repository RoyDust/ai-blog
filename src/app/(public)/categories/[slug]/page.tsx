import { redirect } from "next/navigation";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/posts?category=${encodeURIComponent(slug)}`);
}
