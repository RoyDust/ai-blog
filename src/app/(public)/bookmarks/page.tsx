import type { Metadata } from "next";

import { buildNoIndexMetadata } from "@/lib/seo";

import { BookmarksPageClient } from "./BookmarksPageClient";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "我的收藏",
  description: "本地保存的个人阅读列表。",
  path: "/bookmarks",
});

export default function BookmarksPage() {
  return <BookmarksPageClient />;
}
