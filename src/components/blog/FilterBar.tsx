"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";

interface FilterBarProps {
  search?: string;
  category?: string;
  tag?: string;
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
}

function buildFilterHref({
  search,
  category,
  tag,
}: {
  search?: string;
  category?: string;
  tag?: string;
}) {
  const params = new URLSearchParams();

  if (search) params.set("q", search);
  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);

  const query = params.toString();
  return query ? `/posts?${query}` : "/posts";
}

const allCategoryValue = "__all_categories__";
const allTagValue = "__all_tags__";
const filterSelectTriggerClassName = "w-full rounded-xl border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-none";
const filterSelectContentClassName = "rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";

export function FilterBar({ search, category, tag, categories, tags }: FilterBarProps) {
  const [selectedCategory, setSelectedCategory] = useState(category || allCategoryValue);
  const [selectedTag, setSelectedTag] = useState(tag || allTagValue);
  const categoryValue = selectedCategory === allCategoryValue ? "" : selectedCategory;
  const tagValue = selectedTag === allTagValue ? "" : selectedTag;
  const hasActiveFilters = Boolean(search || categoryValue || tagValue);

  return (
    <form
      className="card-base sticky z-30 space-y-4 p-4"
      method="get"
      style={{ top: "calc(var(--sidebar-sticky-top, 0px) + 1rem)" }}
    >
      {search ? <input type="hidden" name="q" value={search} /> : null}
      {categoryValue ? <input type="hidden" name="category" value={categoryValue} /> : null}
      {tagValue ? <input type="hidden" name="tag" value={tagValue} /> : null}
      <div className="grid gap-3 lg:grid-cols-[repeat(2,minmax(0,1fr))_auto]">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger aria-label="分类筛选" className={filterSelectTriggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={filterSelectContentClassName}>
            <SelectItem value={allCategoryValue}>全部分类</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedTag} onValueChange={setSelectedTag}>
          <SelectTrigger aria-label="标签筛选" className={filterSelectTriggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={filterSelectContentClassName}>
            <SelectItem value={allTagValue}>全部标签</SelectItem>
            {tags.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button className="ui-btn rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">
          应用筛选
        </button>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          {search ? <Link className="ui-chip" href={buildFilterHref({ category: categoryValue, tag: tagValue })}>关键词: {search}</Link> : null}
          {categoryValue ? <Link className="ui-chip" href={buildFilterHref({ search, tag: tagValue })}>分类: {categoryValue}</Link> : null}
          {tagValue ? <Link className="ui-chip" href={buildFilterHref({ search, category: categoryValue })}>标签: {tagValue}</Link> : null}
          <Link className="text-sm font-medium text-[var(--brand)]" href="/posts">清空筛选</Link>
        </div>
      ) : null}
    </form>
  );
}
