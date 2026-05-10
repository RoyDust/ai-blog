import type { Metadata } from "next";

import { getBlogSettings } from "@/lib/blog-settings";
import { buildNoIndexMetadata } from "@/lib/seo";

import { SearchPageClient } from "./SearchPageClient";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildNoIndexMetadata({
    title: "搜索",
    description: "搜索站内文章标题、摘要、正文、标签与分类。",
    path: "/search",
    siteUrl: settings.siteUrl,
  });
}

export default function SearchPage() {
  return <SearchPageClient />;
}
