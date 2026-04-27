"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResultCard } from "@/components/search/SearchResultCard";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImage: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
  category: { name: string; slug: string } | null;
  tags: Array<{ name: string; slug: string }>;
  _count: { comments: number; likes: number };
}

interface SearchResultState {
  query: string;
  posts: Post[];
  error: string | null;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const hasQuery = query.length > 0;
  const [result, setResult] = useState<SearchResultState>({
    query: "",
    posts: [],
    error: null,
  });

  useEffect(() => {
    if (!hasQuery) {
      return;
    }

    let alive = true;

    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "搜索失败");
        }
        return data;
      })
      .then((data) => {
        if (alive && data.success) {
          setResult({ query, posts: data.data, error: null });
        }
      })
      .catch((requestError: Error) => {
        if (alive) {
          setResult({ query, posts: [], error: requestError.message });
        }
      });

    return () => {
      alive = false;
    };
  }, [hasQuery, query]);

  const isResolvedForQuery = result.query === query;
  const visiblePosts = hasQuery && isResolvedForQuery ? result.posts : [];
  const visibleError = hasQuery && isResolvedForQuery ? result.error : null;
  const visibleLoading = hasQuery && !isResolvedForQuery;

  return (
    <div className="space-y-6">
      <section className="ui-surface rounded-2xl p-6">
        <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">搜索结果</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">输入关键词，搜索文章标题、摘要、正文、标签与分类。</p>
        <div className="mt-4">
          <SearchForm defaultValue={query} />
        </div>
      </section>

      {visibleLoading ? <p className="py-12 text-center text-[var(--muted)]">正在搜索...</p> : null}
      {visibleError ? <p className="py-12 text-center text-[var(--danger-foreground)]">{visibleError}</p> : null}

      {!visibleLoading && !visibleError && hasQuery && visiblePosts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {visiblePosts.map((post) => (
            <SearchResultCard key={post.id} post={post} query={query} />
          ))}
        </div>
      ) : null}

      {!visibleLoading && !visibleError ? (
        <p className="py-12 text-center text-[var(--muted)]">
          {hasQuery ? (visiblePosts.length === 0 ? "未找到相关结果" : `找到 ${visiblePosts.length} 条结果`) : "请输入关键词开始搜索"}
        </p>
      ) : null}
    </div>
  );
}

export function SearchPageClient() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-[var(--muted)]">加载搜索页面...</p>}>
      <SearchContent />
    </Suspense>
  );
}
