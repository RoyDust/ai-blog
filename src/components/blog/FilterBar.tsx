"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/coss/ui/select";

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
  "h-9 w-full min-w-0 rounded-xl border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,var(--card-bg)_48%)] px-3 text-sm font-medium text-[var(--foreground)] shadow-none transition-colors before:hidden hover:border-[var(--reader-border-strong)] hover:bg-[color:color-mix(in_oklab,var(--surface-alt)_68%,var(--card-bg)_32%)] data-popup-open:border-[var(--reader-border-strong)]";
const filterSelectContentClassName =
  "w-(--anchor-width) min-w-(--anchor-width) rounded-xl border border-[var(--reader-border)] bg-[var(--float-panel-bg)] text-[var(--foreground)] shadow-[var(--shadow-ambient)] backdrop-blur-xl before:hidden";
const filterSelectItemClassName =
  "rounded-lg text-sm text-[var(--foreground)] data-highlighted:bg-[var(--btn-regular-bg)] data-highlighted:text-[var(--btn-content)] data-selected:font-semibold data-selected:text-[var(--btn-content)]";

export function FilterBar({ search, category, tag, type, categories, tags }: FilterBarProps) {
  const initialCategory = category || allCategoryValue;
  const initialTag = tag || allTagValue;

  return (
    <FilterBarForm
      key={`${initialCategory}:${initialTag}:${type ?? "all"}`}
      appliedCategory={category ?? ""}
      appliedTag={tag ?? ""}
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
  appliedCategory,
  appliedTag,
  initialCategory,
  initialTag,
  type,
  categories,
  tags,
}: {
  search?: string;
  appliedCategory: string;
  appliedTag: string;
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
  const hasAppliedFilters = Boolean(search || appliedCategory || appliedTag || type);
  const hasPendingChanges = categoryValue !== appliedCategory || tagValue !== appliedTag;
  const categoryItems = [
    { value: allCategoryValue, label: "全部分类" },
    ...categories.map((item) => ({ value: item.slug, label: item.name })),
  ];
  const tagItems = [
    { value: allTagValue, label: "全部标签" },
    ...tags.map((item) => ({ value: item.slug, label: item.name })),
  ];

  function resetSelectionState() {
    setSelectedCategory(allCategoryValue);
    setSelectedTag(allTagValue);
  }

  return (
    <form className="min-w-0 shrink-0 space-y-2.5" method="get">
      {search ? <input type="hidden" name="q" value={search} /> : null}
      {categoryValue ? <input type="hidden" name="category" value={categoryValue} /> : null}
      {tagValue ? <input type="hidden" name="tag" value={tagValue} /> : null}
      {type ? <input type="hidden" name="type" value={type} /> : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {hasAppliedFilters ? (
          <Link
            className="text-xs font-semibold text-[var(--brand)] transition-colors hover:text-[var(--brand-strong)]"
            href="/posts"
            onClick={resetSelectionState}
          >
            清空筛选
          </Link>
        ) : hasPendingChanges ? (
          <button
            className="cursor-pointer text-xs font-semibold text-[var(--brand)] transition-colors hover:text-[var(--brand-strong)]"
            onClick={resetSelectionState}
            type="button"
          >
            清空筛选
          </button>
        ) : null}
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
                  category: appliedCategory || undefined,
                  tag: appliedTag || undefined,
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

      <div className="grid gap-2 sm:grid-cols-[10.5rem_10.5rem_auto]">
        <Select
          items={categoryItems}
          value={selectedCategory}
          onValueChange={(value) => {
            if (value !== null) {
              setSelectedCategory(value);
            }
          }}
        >
          <SelectTrigger aria-label="分类筛选" className={filterSelectTriggerClassName}>
            <SelectValue className="min-w-0 truncate" />
          </SelectTrigger>
          <SelectContent className={filterSelectContentClassName}>
            <SelectItem className={filterSelectItemClassName} value={allCategoryValue}>
              全部分类
            </SelectItem>
            {categories.map((item) => (
              <SelectItem key={item.slug} className={filterSelectItemClassName} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={tagItems}
          value={selectedTag}
          onValueChange={(value) => {
            if (value !== null) {
              setSelectedTag(value);
            }
          }}
        >
          <SelectTrigger aria-label="标签筛选" className={filterSelectTriggerClassName}>
            <SelectValue className="min-w-0 truncate" />
          </SelectTrigger>
          <SelectContent className={filterSelectContentClassName}>
            <SelectItem className={filterSelectItemClassName} value={allTagValue}>
              全部标签
            </SelectItem>
            {tags.map((item) => (
              <SelectItem key={item.slug} className={filterSelectItemClassName} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button className="ui-btn h-9 shrink-0 whitespace-nowrap rounded-xl bg-[var(--btn-regular-bg)] px-4 text-sm font-semibold text-[var(--btn-content)] transition hover:bg-[var(--btn-regular-bg-hover)]" type="submit">
          应用筛选
        </button>
      </div>
    </form>
  );
}
