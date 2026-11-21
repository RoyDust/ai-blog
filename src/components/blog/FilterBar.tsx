"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import { TextLink } from "@/components/editorial";
import { collapseMotion, editorialEase } from "@/components/editorial/motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { cn } from "@/lib/cn";

interface FilterOption {
  name: string;
  slug: string;
}

interface FilterBarProps {
  search?: string;
  category?: string;
  tag?: string;
  categories: FilterOption[];
  tags: FilterOption[];
  /** 当前条件下的文章总数，用于等宽状态行「共 N 篇 · 按发布时间」 */
  total?: number;
  title?: string;
}

function buildFilterHref({ search, category, tag }: { search?: string; category?: string; tag?: string }) {
  const params = new URLSearchParams();

  if (search) params.set("q", search);
  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);

  const query = params.toString();
  return query ? `/posts?${query}` : "/posts";
}

const allCategoryValue = "__all_categories__";
const allTagValue = "__all_tags__";
const selectTriggerClassName =
  "h-11 w-full min-w-[9.5rem] gap-2 rounded-[var(--radius-ctl)] border-[var(--reader-border-strong)] bg-transparent px-3 text-[0.875rem] text-[var(--foreground)] shadow-none transition-colors hover:border-[var(--text-muted)] data-[state=open]:border-[var(--foreground)] dark:bg-transparent dark:hover:bg-transparent";
const selectContentClassName =
  "ed-popover rounded-[var(--radius-paper)] shadow-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1";

/**
 * `/posts` 报头式页头（简报 16.3）：左边衬线 h1 + 等宽状态行，右边两个下拉 + 描边「应用筛选」，下方 2px 粗线；
 * 粗线下一行列出已选条件（可点移除）与「清空筛选 →」。手机上筛选折叠成「筛选」描边按钮，就地展开。
 */
export function FilterBar(props: FilterBarProps) {
  const initialCategory = props.category || allCategoryValue;
  const initialTag = props.tag || allTagValue;

  return <FilterBarForm key={`${initialCategory}:${initialTag}`} {...props} initialCategory={initialCategory} initialTag={initialTag} />;
}

function FilterSelects({
  categories,
  tags,
  selectedCategory,
  selectedTag,
  onCategoryChange,
  onTagChange,
}: {
  categories: FilterOption[];
  tags: FilterOption[];
  selectedCategory: string;
  selectedTag: string;
  onCategoryChange: (value: string) => void;
  onTagChange: (value: string) => void;
}) {
  return (
    <>
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger aria-label="分类筛选" className={selectTriggerClassName}>
          <span className="shrink-0 text-[var(--text-muted)]">分类</span>
          <span className="min-w-0 flex-1 truncate text-left font-bold">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent className={selectContentClassName}>
          <SelectItem value={allCategoryValue}>全部</SelectItem>
          {categories.map((item) => (
            <SelectItem key={item.slug} value={item.slug}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedTag} onValueChange={onTagChange}>
        <SelectTrigger aria-label="标签筛选" className={selectTriggerClassName}>
          <span className="shrink-0 text-[var(--text-muted)]">标签</span>
          <span className="min-w-0 flex-1 truncate text-left font-bold">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent className={selectContentClassName}>
          <SelectItem value={allTagValue}>全部</SelectItem>
          {tags.map((item) => (
            <SelectItem key={item.slug} value={item.slug}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function FilterBarForm({
  search,
  category,
  tag,
  categories,
  tags,
  total,
  title = "全部文章",
  initialCategory,
  initialTag,
}: FilterBarProps & { initialCategory: string; initialTag: string }) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelId = useId();

  const categoryValue = selectedCategory === allCategoryValue ? "" : selectedCategory;
  const tagValue = selectedTag === allTagValue ? "" : selectedTag;
  const activeCategory = category ? categories.find((item) => item.slug === category) : undefined;
  const activeTag = tag ? tags.find((item) => item.slug === tag) : undefined;
  const activeCount = [search, category, tag].filter(Boolean).length;

  const hiddenInputs = (
    <>
      {search ? <input type="hidden" name="q" value={search} /> : null}
      {categoryValue ? <input type="hidden" name="category" value={categoryValue} /> : null}
      {tagValue ? <input type="hidden" name="tag" value={tagValue} /> : null}
    </>
  );

  const selects = (
    <FilterSelects
      categories={categories}
      onCategoryChange={setSelectedCategory}
      onTagChange={setSelectedTag}
      selectedCategory={selectedCategory}
      selectedTag={selectedTag}
      tags={tags}
    />
  );

  const conditions = [
    search ? { key: "q", label: "关键词", value: search, href: buildFilterHref({ category, tag }) } : null,
    category ? { key: "category", label: "分类", value: activeCategory?.name ?? category, href: buildFilterHref({ search, tag }) } : null,
    tag ? { key: "tag", label: "标签", value: activeTag?.name ?? tag, href: buildFilterHref({ search, category }) } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-5">
        <div className="min-w-0 space-y-1.5">
          <h1 className="ed-serif text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.15] text-[var(--foreground)]">{title}</h1>
          <p className="ed-mono text-[0.8125rem] text-[var(--text-muted)]">
            {typeof total === "number" ? (
              <>
                共 {total} <span className="font-sans">篇</span>
                <span aria-hidden="true" className="px-1.5">
                  ·
                </span>
              </>
            ) : null}
            <span className="font-sans">按发布时间</span>
          </p>
        </div>

        {/* 桌面：两个下拉 + 描边按钮 */}
        <form className="hidden min-w-0 items-center gap-2 sm:flex" method="get" aria-label="筛选文章">
          {hiddenInputs}
          <div className="grid grid-cols-2 gap-2">{selects}</div>
          <button className="ed-btn-outline" type="submit">
            应用筛选
          </button>
        </form>

        {/* 手机：折叠成「筛选」描边按钮 */}
        <button
          aria-controls={panelId}
          aria-expanded={mobileOpen}
          className="ed-btn-outline sm:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          筛选
          {activeCount > 0 ? <span className="ed-mono font-normal">{activeCount}</span> : null}
        </button>
      </div>

      <hr className="ed-rule-strong" />

      <AnimatePresence initial={false}>
        {mobileOpen ? (
          <motion.div
            key="mobile-filter"
            id={panelId}
            className="overflow-hidden sm:hidden"
            {...(reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : collapseMotion)}
          >
            <form className="space-y-3 border-b border-[var(--border)] py-4" method="get" aria-label="筛选文章">
              {hiddenInputs}
              <p className="text-[0.8125rem] text-[var(--text-muted)]">选好后点「应用筛选」</p>
              <div className="grid grid-cols-2 gap-2">{selects}</div>
              <button className="ed-btn-outline ed-btn--block" type="submit">
                应用筛选
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {conditions.length > 0 ? (
          <motion.div
            key="conditions"
            className="flex flex-wrap items-center justify-between gap-x-4 border-b border-[var(--border)] py-1"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: editorialEase }}
          >
            <ul className="flex flex-wrap items-center gap-x-1">
              {conditions.map((condition) => (
                <li key={condition.key}>
                  <Link
                    aria-label={`移除${condition.label}：${condition.value}`}
                    className={cn(
                      "group inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-ctl)] px-2 text-[0.875rem] transition-colors hover:bg-[var(--ed-press-bg)]",
                    )}
                    href={condition.href}
                  >
                    <span className="text-[var(--text-muted)]">{condition.label}</span>
                    <span className="font-bold text-[var(--foreground)]">{condition.value}</span>
                    <X aria-hidden="true" className="h-3.5 w-3.5 text-[var(--text-muted)] transition-transform group-hover:rotate-90 group-hover:text-[var(--foreground)]" />
                  </Link>
                </li>
              ))}
            </ul>
            <TextLink href="/posts">清空筛选</TextLink>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
