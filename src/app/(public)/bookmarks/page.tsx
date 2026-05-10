import type { Metadata } from "next";

import { getBlogSettings } from "@/lib/blog-settings";
import { buildNoIndexMetadata } from "@/lib/seo";

import { BookmarksPageClient } from "./BookmarksPageClient";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildNoIndexMetadata({
    title: "我的收藏",
    description: "本地保存的个人阅读列表。",
    path: "/bookmarks",
    siteUrl: settings.siteUrl,
  });
}

export default function BookmarksPage() {
  return <BookmarksPageClient />;
}
