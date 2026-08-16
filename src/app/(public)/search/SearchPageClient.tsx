"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import useSWR from "swr";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResultCard } from "@/components/search/SearchResultCard";
import { apiFetcher, apiMutate, toErrorMessage } from "@/lib/client-api";

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

interface AiSummaryState {
  query: string;
  summary: string | null;
  error: string | null;
  status: "idle" | "loading" | "ready" | "error";
}

interface SearchResponse {
  success?: boolean;
  data?: Post[];
  ai?: { summary?: string | null };
}

function countQueryCharacters(value: string) {
  return Array.from(value).length;
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const hasQuery = query.length > 0;
  const hasSearchableQuery = countQueryCharacters(query) >= SEARCH_MIN_QUERY_LENGTH;
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const activeSearchQuery = hasSearchableQuery && countQueryCharacters(debouncedQuery) >= SEARCH_MIN_QUERY_LENGTH ? debouncedQuery : "";
  const searchKey = activeSearchQuery ? `/api/search?q=${encodeURIComponent(activeSearchQuery)}` : null;
  const latestQueryRef = useRef(query);
  const [aiSummary, setAiSummary] = useState<AiSummaryState>({
    query: "",
    summary: null,
    error: null,
    status: "idle",
  });
  const {
    data: searchResponse,
    error: searchError,
    isLoading: isSearchLoading,
    mutate: mutateSearch,
  } = useSWR<SearchResponse>(searchKey, apiFetcher, {
    keepPreviousData: false,
    revalidateOnMount: true,
  });

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  async function requestAiSummary() {
    const currentPosts = Array.isArray(searchResponse?.data) ? searchResponse.data : [];
    const isResolvedForCurrentQuery = activeSearchQuery === query && !searchError && !isSearchLoading;

    if (!hasSearchableQuery || !isResolvedForCurrentQuery || currentPosts.length === 0 || aiSummary.status === "loading") {
      return;
    }

    const requestQuery = query;
    setAiSummary({ query: requestQuery, summary: null, error: null, status: "loading" });

    try {
      const data = await apiMutate<SearchResponse>(`/api/search?q=${encodeURIComponent(requestQuery)}&ai=1`);

      if (latestQueryRef.current !== requestQuery) {
        return;
      }

      const summary = typeof data.ai?.summary === "string" ? data.ai.summary.trim() : "";
      if (Array.isArray(data.data)) {
        void mutateSearch({ ...data, data: data.data }, { revalidate: false });
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
        error: toErrorMessage(requestError, "AI 摘要生成失败"),
        status: "error",
      });
    }
  }

  const searchPosts = Array.isArray(searchResponse?.data) ? searchResponse.data : [];
  const isResolvedForQuery = activeSearchQuery === query && !searchError && !isSearchLoading;
  const visiblePosts = hasSearchableQuery && isResolvedForQuery ? searchPosts : [];
  const visibleAiSummary = hasSearchableQuery && aiSummary.query === query && aiSummary.status === "ready" ? aiSummary.summary : null;
  const visibleAiError = hasSearchableQuery && aiSummary.query === query && aiSummary.status === "error" ? aiSummary.error : null;
  const visibleError = hasSearchableQuery && activeSearchQuery === query && searchError ? toErrorMessage(searchError, "搜索失败") : null;
  const visibleLoading = hasSearchableQuery && !visibleError && (activeSearchQuery !== query || isSearchLoading);
  const isAiLoading = aiSummary.query === query && aiSummary.status === "loading";
  const canRequestAiSummary = hasSearchableQuery && isResolvedForQuery && visiblePosts.length > 0 && !isAiLoading;

  return (
    <div className="space-y-6">
      <section className="ui-surface rounded-2xl p-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--foreground)] md:text-4xl">搜索结果</h1>
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

export function SearchPageClient() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-[var(--muted)]">加载搜索页面...</p>}>
      <SearchContent />
    </Suspense>
  );
}
