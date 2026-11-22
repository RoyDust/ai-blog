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
  type?: "original" | "ai-daily";
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
}

function buildFilterHref({
  search,
  category,
  tag,
  type,
}: {
  search?: string;
  category?: string;
  tag?: string;
  type?: "original" | "ai-daily";
}) {
  const params = new URLSearchParams();

  if (search) params.set("q", search);
  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);
  if (type) params.set("type", type);

  const query = params.toString();
  return query ? `/posts?${query}` : "/posts";
}

const allCategoryValue = "__all_categories__";
const allTagValue = "__all_tags__";
const filterSelectTriggerClassName =
  "h-9 w-full rounded-xl border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,var(--card-bg)_48%)] px-3 text-sm text-[var(--foreground)] shadow-none";
const filterSelectContentClassName =
  "rounded-xl border-[var(--reader-border)] bg-[var(--float-panel-bg)] text-[var(--foreground)]";

export function FilterBar({ search, category, tag, type, categories, tags }: FilterBarProps) {
  const initialCategory = category || allCategoryValue;
  const initialTag = tag || allTagValue;

  return (
    <FilterBarForm
      key={`${initialCategory}:${initialTag}:${type ?? "all"}`}
      categories={categories}
      initialCategory={initialCategory}
      initialTag={initialTag}
      search={search}
      tags={tags}
      type={type}
    />
  );
}

function FilterBarForm({
  search,
  initialCategory,
  initialTag,
  type,
  categories,
  tags,
}: {
  search?: string;
  initialCategory: string;
  initialTag: string;
  type?: "original" | "ai-daily";
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
}) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedTag, setSelectedTag] = useState(initialTag);

  const categoryValue = selectedCategory === allCategoryValue ? "" : selectedCategory;
  const tagValue = selectedTag === allTagValue ? "" : selectedTag;
  const hasActiveFilters = Boolean(search || categoryValue || tagValue || type);
  const typeLabel = type === "original" ? "原创文章" : type === "ai-daily" ? "AI 日报" : null;

  return (
    <form className="min-w-0 space-y-2.5" method="get">
      {search ? <input type="hidden" name="q" value={search} /> : null}
      {categoryValue ? <input type="hidden" name="category" value={categoryValue} /> : null}
      {tagValue ? <input type="hidden" name="tag" value={tagValue} /> : null}
      {type ? <input type="hidden" name="type" value={type} /> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div
          role="group"
          aria-label="内容类型筛选"
          className="inline-flex items-center gap-0.5 rounded-xl border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,var(--card-bg)_48%)] p-1"
        >
          {(
            [
              { id: undefined, label: "全部" },
              { id: "original", label: "原创文章" },
              { id: "ai-daily", label: "AI 日报" },
            ] as const
          ).map((item) => {
            const active = (type ?? undefined) === item.id;
            return (
              <Link
                key={item.label}
                href={buildFilterHref({
                  search,
                  category: categoryValue || undefined,
                  tag: tagValue || undefined,
                  type: item.id,
                })}
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[var(--btn-regular-bg)] text-[var(--btn-content)]"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(8.5rem,11rem)_minmax(8.5rem,11rem)_auto]">
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
        <button className="ui-btn h-9 shrink-0 whitespace-nowrap rounded-xl bg-[var(--btn-regular-bg)] px-4 text-sm font-semibold text-[var(--btn-content)] transition hover:bg-[var(--btn-regular-bg-hover)]" type="submit">
          应用筛选
        </button>
      </div>

      {hasActiveFilters ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--line-color)] pt-2.5">
          {typeLabel ? <Link className="ui-chip" href={buildFilterHref({ search, category: categoryValue, tag: tagValue })}>类型: {typeLabel}</Link> : null}
          {search ? <Link className="ui-chip" href={buildFilterHref({ category: categoryValue, tag: tagValue, type })}>关键词: {search}</Link> : null}
          {categoryValue ? <Link className="ui-chip" href={buildFilterHref({ search, tag: tagValue, type })}>分类: {categoryValue}</Link> : null}
          {tagValue ? <Link className="ui-chip" href={buildFilterHref({ search, category: categoryValue, type })}>标签: {tagValue}</Link> : null}
          <Link className="text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-strong)]" href="/posts">清空筛选</Link>
        </div>
      ) : null}
    </form>
  );
}
