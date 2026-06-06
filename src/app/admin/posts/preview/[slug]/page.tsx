export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { renderArticlePage } from "@/app/(public)/posts/[slug]/page";

export const metadata: Metadata = {
  title: "草稿预览",
  robots: { index: false, follow: false },
};

export default async function AdminPostPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return renderArticlePage({ slug, includeDraft: true });
}
