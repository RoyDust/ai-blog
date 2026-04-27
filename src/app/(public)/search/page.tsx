import type { Metadata } from "next";

import { buildNoIndexMetadata } from "@/lib/seo";

import { SearchPageClient } from "./SearchPageClient";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "搜索",
  description: "搜索站内文章标题、摘要、正文、标签与分类。",
  path: "/search",
});

export default function SearchPage() {
  return <SearchPageClient />;
}
