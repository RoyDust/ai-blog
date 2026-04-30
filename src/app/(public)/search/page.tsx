"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResultCard } from "@/components/search/SearchResultCard";

const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

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
  status: "idle" | "loading" | "ready" | "error";
}

interface AiSummaryState {
  query: string;
  summary: string | null;
  error: string | null;
  status: "idle" | "loading" | "ready" | "error";
}

function countQueryCharacters(value: string) {
  return Array.from(value).length;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const hasQuery = query.length > 0;
  const hasSearchableQuery = countQueryCharacters(query) >= SEARCH_MIN_QUERY_LENGTH;
  const latestQueryRef = useRef(query);
  const [result, setResult] = useState<SearchResultState>({
    query: "",
    posts: [],
    error: null,
    status: "idle",
  });
  const [aiSummary, setAiSummary] = useState<AiSummaryState>({
    query: "",
    summary: null,
    error: null,
    status: "idle",
  });

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (!hasQuery) {
      setResult({ query: "", posts: [], error: null, status: "idle" });
      setAiSummary({ query: "", summary: null, error: null, status: "idle" });
      return;
    }

    if (!hasSearchableQuery) {
      setResult({ query, posts: [], error: null, status: "idle" });
      setAiSummary({ query, summary: null, error: null, status: "idle" });
      return;
    }

    let alive = true;
    const timer = window.setTimeout(() => {
      setResult({ query, posts: [], error: null, status: "loading" });
      setAiSummary({ query, summary: null, error: null, status: "idle" });

      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "搜索失败");
          }
          return data;
        })
        .then((data) => {
          if (alive) {
            setResult({ query, posts: Array.isArray(data.data) ? data.data : [], error: null, status: "ready" });
          }
        })
        .catch((requestError: Error) => {
          if (alive) {
            setResult({ query, posts: [], error: requestError.message, status: "error" });
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [hasQuery, hasSearchableQuery, query]);

  async function requestAiSummary() {
    if (!hasSearchableQuery || result.query !== query || result.status !== "ready" || result.posts.length === 0 || aiSummary.status === "loading") {
      return;
    }

    const requestQuery = query;
    setAiSummary({ query: requestQuery, summary: null, error: null, status: "loading" });

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(requestQuery)}&ai=1`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "AI 摘要生成失败");
      }

      if (latestQueryRef.current !== requestQuery) {
        return;
      }

      const summary = typeof data.ai?.summary === "string" ? data.ai.summary.trim() : "";
      if (Array.isArray(data.data)) {
        setResult({ query: requestQuery, posts: data.data, error: null, status: "ready" });
      }

      setAiSummary({
        query: requestQuery,
        summary: summary || null,
        error: summary ? null : "AI 摘要暂不可用",
        status: summary ? "ready" : "error",
      });
    } catch (requestError) {
      if (latestQueryRef.current !== requestQuery) {
        return;
      }

      setAiSummary({
        query: requestQuery,
        summary: null,
        error: requestError instanceof Error ? requestError.message : "AI 摘要生成失败",
        status: "error",
      });
    }
  }

  const isResolvedForQuery = result.query === query && result.status === "ready";
  const visiblePosts = hasSearchableQuery && isResolvedForQuery ? result.posts : [];
  const visibleAiSummary = hasSearchableQuery && aiSummary.query === query && aiSummary.status === "ready" ? aiSummary.summary : null;
  const visibleAiError = hasSearchableQuery && aiSummary.query === query && aiSummary.status === "error" ? aiSummary.error : null;
  const visibleError = hasSearchableQuery && result.query === query && result.status === "error" ? result.error : null;
  const visibleLoading = hasSearchableQuery && (result.query !== query || result.status === "loading");
  const isAiLoading = aiSummary.query === query && aiSummary.status === "loading";
  const canRequestAiSummary = hasSearchableQuery && isResolvedForQuery && visiblePosts.length > 0 && !isAiLoading;

  return (
    <div className="space-y-6">
      <section className="ui-surface rounded-2xl p-6">
        <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">搜索结果</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">输入关键词，搜索文章标题、摘要、正文、标签与分类。</p>
        <div className="mt-4">
          <SearchForm defaultValue={query} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="ui-btn inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[color:color-mix(in_srgb,var(--primary)_35%,var(--border))] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canRequestAiSummary}
            onClick={requestAiSummary}
            type="button"
          >
            {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isAiLoading ? "生成中" : "AI 搜索摘要"}
          </button>
          {hasQuery && !hasSearchableQuery ? <p className="text-sm text-[var(--muted)]">至少输入 {SEARCH_MIN_QUERY_LENGTH} 个字符。</p> : null}
          {visibleAiError ? <p className="text-sm text-[var(--danger-foreground)]">{visibleAiError}</p> : null}
        </div>
      </section>

      {visibleLoading ? <p className="py-12 text-center text-[var(--muted)]">正在搜索...</p> : null}
      {visibleError ? <p className="py-12 text-center text-[var(--danger-foreground)]">{visibleError}</p> : null}

      {!visibleLoading && !visibleError && visibleAiSummary ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">AI 搜索摘要</p>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{visibleAiSummary}</p>
        </section>
      ) : null}

      {!visibleLoading && !visibleError && hasQuery && visiblePosts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {visiblePosts.map((post) => (
            <SearchResultCard key={post.id} post={post} query={query} />
          ))}
        </div>
      ) : null}

      {!visibleLoading && !visibleError ? (
        <p className="py-12 text-center text-[var(--muted)]">
          {!hasQuery
            ? "请输入关键词开始搜索"
            : !hasSearchableQuery
              ? `至少输入 ${SEARCH_MIN_QUERY_LENGTH} 个字符再搜索`
              : visiblePosts.length === 0
                ? "未找到相关结果"
                : `找到 ${visiblePosts.length} 条结果`}
        </p>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-[var(--muted)]">加载搜索页面...</p>}>
      <SearchContent />
    </Suspense>
  );
}
