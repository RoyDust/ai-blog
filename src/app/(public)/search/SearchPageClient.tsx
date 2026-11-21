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

function getSearchStatusMessage(hasQuery: boolean, hasSearchableQuery: boolean, resultCount: number) {
  if (!hasQuery) return "请输入关键词开始搜索";
  if (!hasSearchableQuery) return `至少输入 ${SEARCH_MIN_QUERY_LENGTH} 个字符再搜索`;
  if (resultCount === 0) return "未找到相关结果";
  return `找到 ${resultCount} 条结果`;
}

function deriveSearchViewState({
  query,
  activeSearchQuery,
  hasSearchableQuery,
  searchResponse,
  searchError,
  isSearchLoading,
  aiSummary,
}: {
  query: string;
  activeSearchQuery: string;
  hasSearchableQuery: boolean;
  searchResponse: SearchResponse | undefined;
  searchError: unknown;
  isSearchLoading: boolean;
  aiSummary: AiSummaryState;
}) {
  const searchPosts = Array.isArray(searchResponse?.data) ? searchResponse.data : [];
  const isResolvedForQuery = activeSearchQuery === query && !searchError && !isSearchLoading;
  const visiblePosts = hasSearchableQuery && isResolvedForQuery ? searchPosts : [];
  const isCurrentAiQuery = hasSearchableQuery && aiSummary.query === query;
  const visibleAiSummary = isCurrentAiQuery && aiSummary.status === "ready" ? aiSummary.summary : null;
  const visibleAiError = isCurrentAiQuery && aiSummary.status === "error" ? aiSummary.error : null;
  const visibleError =
    hasSearchableQuery && activeSearchQuery === query && searchError ? toErrorMessage(searchError, "搜索失败") : null;
  const visibleLoading = hasSearchableQuery && !visibleError && (activeSearchQuery !== query || isSearchLoading);
  const isAiLoading = aiSummary.query === query && aiSummary.status === "loading";
  const canRequestAiSummary = hasSearchableQuery && isResolvedForQuery && visiblePosts.length > 0 && !isAiLoading;

  return {
    isResolvedForQuery,
    searchPosts,
    visiblePosts,
    visibleAiSummary,
    visibleAiError,
    visibleError,
    visibleLoading,
    isAiLoading,
    canRequestAiSummary,
  };
}

function parseAiSummaryOutcome(requestQuery: string, data: SearchResponse): AiSummaryState {
  const summary = typeof data.ai?.summary === "string" ? data.ai.summary.trim() : "";
  return {
    query: requestQuery,
    summary: summary || null,
    error: summary ? null : "AI 摘要暂不可用",
    status: summary ? "ready" : "error",
  };
}

function SearchResultsBody({
  query,
  hasQuery,
  hasSearchableQuery,
  visibleLoading,
  visibleError,
  visibleAiSummary,
  visiblePosts,
}: {
  query: string;
  hasQuery: boolean;
  hasSearchableQuery: boolean;
  visibleLoading: boolean;
  visibleError: string | null;
  visibleAiSummary: string | null;
  visiblePosts: Post[];
}) {
  if (visibleLoading) {
    return <div className="reader-panel py-10 text-center text-sm text-[var(--text-muted)]">正在搜索...</div>;
  }

  if (visibleError) {
    return (
      <div className="reader-panel border-[var(--danger-border)] bg-[var(--danger-surface)] py-8 text-center text-sm text-[var(--danger-foreground)]">
        {visibleError}
      </div>
    );
  }

  return (
    <>
      {visibleAiSummary ? (
        <section className="reader-panel space-y-2 p-5">
          <h2 className="reader-section-heading text-sm">AI 搜索摘要</h2>
          <p className="text-sm leading-6 text-[var(--text-body)]">{visibleAiSummary}</p>
        </section>
      ) : null}

      {hasQuery && visiblePosts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {visiblePosts.map((post) => (
            <SearchResultCard key={post.id} post={post} query={query} />
          ))}
        </div>
      ) : null}

      <p className="py-6 text-center text-xs text-[var(--text-muted)]">
        {getSearchStatusMessage(hasQuery, hasSearchableQuery, visiblePosts.length)}
      </p>
    </>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const hasQuery = query.length > 0;
  const hasSearchableQuery = countQueryCharacters(query) >= SEARCH_MIN_QUERY_LENGTH;
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const activeSearchQuery =
    hasSearchableQuery && countQueryCharacters(debouncedQuery) >= SEARCH_MIN_QUERY_LENGTH ? debouncedQuery : "";
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
    keepPreviousData: true,
    revalidateOnMount: true,
  });

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  const viewState = deriveSearchViewState({
    query,
    activeSearchQuery,
    hasSearchableQuery,
    searchResponse,
    searchError,
    isSearchLoading,
    aiSummary,
  });

  async function requestAiSummary() {
    if (!viewState.canRequestAiSummary) {
      return;
    }

    const requestQuery = query;
    setAiSummary({ query: requestQuery, summary: null, error: null, status: "loading" });

    try {
      const data = await apiMutate<SearchResponse>(`/api/search?q=${encodeURIComponent(requestQuery)}&ai=1`);
      if (latestQueryRef.current !== requestQuery) return;

      if (Array.isArray(data.data)) {
        void mutateSearch({ ...data, data: data.data }, { revalidate: false });
      }
      setAiSummary(parseAiSummaryOutcome(requestQuery, data));
    } catch (requestError) {
      if (latestQueryRef.current !== requestQuery) return;

      setAiSummary({
        query: requestQuery,
        summary: null,
        error: toErrorMessage(requestError, "AI 摘要生成失败"),
        status: "error",
      });
    }
  }

  return (
    <div className="reader-section">
      <section className="reader-panel p-5 md:p-6">
        <h1 className="text-90 font-display text-2xl font-bold leading-snug tracking-tight md:text-3xl">搜索结果</h1>
        <p className="mt-1.5 text-sm text-[var(--text-body)]">输入关键词，搜索文章标题、摘要、正文、标签与分类。</p>
        <div className="mt-4">
          <SearchForm defaultValue={query} />
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <button
            className="ui-btn inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--btn-regular-bg)] px-3.5 text-xs font-semibold text-[var(--btn-content)] transition hover:bg-[var(--btn-regular-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!viewState.canRequestAiSummary}
            onClick={requestAiSummary}
            type="button"
          >
            {viewState.isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {viewState.isAiLoading ? "生成中" : "AI 搜索摘要"}
          </button>
          {hasQuery && !hasSearchableQuery ? <p className="text-xs text-[var(--text-muted)]">至少输入 {SEARCH_MIN_QUERY_LENGTH} 个字符。</p> : null}
          {viewState.visibleAiError ? <p className="text-xs text-[var(--danger-foreground)]">{viewState.visibleAiError}</p> : null}
        </div>
      </section>

      <SearchResultsBody
        hasQuery={hasQuery}
        hasSearchableQuery={hasSearchableQuery}
        query={query}
        visibleAiSummary={viewState.visibleAiSummary}
        visibleError={viewState.visibleError}
        visibleLoading={viewState.visibleLoading}
        visiblePosts={viewState.visiblePosts}
      />
    </div>
  );
}

export function SearchPageClient() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-[var(--text-muted)]">加载搜索页面...</p>}>
      <SearchContent />
    </Suspense>
  );
}
