"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import useSWR from "swr";
import {
  EmptyState,
  ListRowSkeleton,
  SectionHeading,
  SkeletonBar,
  StaggerItem,
  StaggerList,
  TextLink,
  collapseMotion,
  editorialEase,
} from "@/components/editorial";
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
  viewCount?: number;
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

type SearchPhase = "start" | "short" | "loading" | "error" | "empty" | "results";

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
  const reduceMotion = useReducedMotion();
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
  const isQueryTooShort = hasQuery && !hasSearchableQuery;
  const phase = getSearchPhase({
    hasQuery,
    hasSearchableQuery,
    hasError: Boolean(visibleError),
    isLoading: visibleLoading,
    resultCount: visiblePosts.length,
  });

  return (
    <>
      <SearchHeader
        aiError={visibleAiError}
        canRequestAiSummary={canRequestAiSummary}
        isAiLoading={isAiLoading}
        isQueryTooShort={isQueryTooShort}
        onRequestAiSummary={requestAiSummary}
        query={query}
        reduceMotion={reduceMotion}
      />
      <SearchResultsRegion
        aiSummary={visibleAiSummary}
        error={visibleError}
        isAiLoading={isAiLoading}
        onRetry={() => void mutateSearch()}
        phase={phase}
        posts={visiblePosts}
        query={query}
        reduceMotion={reduceMotion}
      />
    </>
  );
}

function getSearchPhase({
  hasQuery,
  hasSearchableQuery,
  hasError,
  isLoading,
  resultCount,
}: {
  hasQuery: boolean;
  hasSearchableQuery: boolean;
  hasError: boolean;
  isLoading: boolean;
  resultCount: number;
}): SearchPhase {
  if (!hasQuery) return "start";
  if (!hasSearchableQuery) return "short";
  if (hasError) return "error";
  if (isLoading) return "loading";
  return resultCount === 0 ? "empty" : "results";
}

function buildFade(reduceMotion: boolean | null) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: reduceMotion ? 0 : 0.22, ease: editorialEase } },
    exit: { opacity: 0, transition: { duration: reduceMotion ? 0 : 0.14 } },
  };
}

/** 页头：eyebrow + 衬线 h1 + 一句说明，搜索框与「搜索」主按钮收进页头，下一行描边「AI 搜索摘要」，2px 粗线收尾 */
function SearchHeader({
  query,
  canRequestAiSummary,
  isAiLoading,
  isQueryTooShort,
  aiError: visibleAiError,
  onRequestAiSummary: requestAiSummary,
  reduceMotion,
}: {
  query: string;
  canRequestAiSummary: boolean;
  isAiLoading: boolean;
  isQueryTooShort: boolean;
  aiError: string | null;
  onRequestAiSummary: () => void;
  reduceMotion: boolean | null;
}) {
  const fade = buildFade(reduceMotion);

  return (
    <header className="ed-masthead">
      <div className="space-y-2 pb-5">
        <p className="ed-eyebrow">搜索</p>
        <h1 className="ed-serif text-balance text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.15] text-[var(--foreground)]">搜索结果</h1>
        <p className="text-[0.9375rem] leading-[1.7] text-[var(--text-body)]">输入关键词，搜索文章标题、摘要、正文、标签与分类。</p>
        <div className="pt-4">
          <SearchForm defaultValue={query} />
        </div>
        <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <button className="ed-btn-outline" disabled={!canRequestAiSummary} onClick={requestAiSummary} type="button">
            {isAiLoading ? "生成中" : "AI 搜索摘要"}
          </button>
          <AnimatePresence initial={false}>
            {isQueryTooShort ? (
              <motion.p key="too-short" className="text-[0.875rem] text-[var(--text-body)]" {...fade}>
                至少输入 {SEARCH_MIN_QUERY_LENGTH} 个字符。
              </motion.p>
            ) : null}
            {visibleAiError ? (
              <motion.p key="ai-error" className="text-[0.8125rem] text-[var(--danger-foreground)]" role="alert" {...fade}>
                {visibleAiError}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <hr className="ed-rule-strong" />
    </header>
  );
}

/** 粗线下方：起始 / 搜索中 / 失败 / 无结果 / 结果（含 AI 摘要）几种状态淡入淡出切换 */
function SearchResultsRegion({
  phase,
  query,
  posts: visiblePosts,
  error: visibleError,
  isAiLoading,
  aiSummary: visibleAiSummary,
  onRetry,
  reduceMotion,
}: {
  phase: SearchPhase;
  query: string;
  posts: Post[];
  error: string | null;
  isAiLoading: boolean;
  aiSummary: string | null;
  onRetry: () => void;
  reduceMotion: boolean | null;
}) {
  const fade = buildFade(reduceMotion);
  const showAiBlock = isAiLoading || Boolean(visibleAiSummary);
  const keywordAside = <span className="max-w-[12rem] truncate sm:max-w-[16rem]">关键词「{query}」</span>;
  const exploreLinks = (
    <>
      <TextLink href="/posts">浏览全部文章</TextLink>
      <TextLink href="/tags">全部标签</TextLink>
    </>
  );

  return (
    <AnimatePresence initial={false} mode="wait">
      {phase === "short" ? null : (
        <motion.div key={phase} className="space-y-[var(--section-gap)]" {...fade}>
          {phase === "start" ? <EmptyState actions={exploreLinks} title="请输入关键词开始搜索" /> : null}

          {phase === "error" ? (
            <EmptyState
              actions={
                <button className="ed-btn-outline" onClick={onRetry} type="button">
                  重试
                </button>
              }
              description={visibleError && visibleError !== "搜索失败" ? visibleError : undefined}
              role="alert"
              title="搜索失败，请稍后重试"
              tone="danger"
            />
          ) : null}

          {phase === "results" ? (
            <AnimatePresence initial={false}>
              {showAiBlock ? (
                <motion.section key="ai-summary" aria-busy={isAiLoading} aria-labelledby="search-ai-summary-title" className="overflow-hidden" {...(reduceMotion ? fade : collapseMotion)}>
                  <SectionHeading id="search-ai-summary-title" title="AI 搜索摘要" />
                  <AnimatePresence initial={false} mode="wait">
                    {isAiLoading ? (
                      <motion.div key="ai-skeleton" className="space-y-3 pb-1 pt-3" {...fade}>
                        <span className="ed-visually-hidden" role="status">
                          正在生成 AI 搜索摘要
                        </span>
                        <SkeletonBar className="h-3.5 w-[96%]" />
                        <SkeletonBar className="h-3.5 w-[92%]" />
                        <SkeletonBar className="h-3.5 w-[58%]" />
                      </motion.div>
                    ) : (
                      <motion.p key="ai-text" className="pt-2 text-[0.9375rem] leading-[1.85] text-[var(--text-body)]" {...fade}>
                        {visibleAiSummary}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.section>
              ) : null}
            </AnimatePresence>
          ) : null}

          {phase === "loading" || phase === "empty" || phase === "results" ? (
            <section aria-labelledby="search-results-title" className="space-y-1">
              <SectionHeading
                aside={keywordAside}
                count={phase === "loading" ? "…" : visiblePosts.length}
                id="search-results-title"
                title="结果"
              />
              {phase === "loading" ? <ListRowSkeleton count={3} label="正在搜索" /> : null}
              {phase === "empty" ? <EmptyState actions={exploreLinks} title="未找到相关结果" /> : null}
              {phase === "results" ? (
                <StaggerList as="ol">
                  {visiblePosts.map((post) => (
                    <StaggerItem key={post.id} as="li">
                      <SearchResultCard post={post} query={query} />
                    </StaggerItem>
                  ))}
                </StaggerList>
              ) : null}
            </section>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SearchPageClient() {
  return (
    <Suspense fallback={<p className="py-6 text-[0.875rem] text-[var(--text-muted)]">加载搜索页面…</p>}>
      <SearchContent />
    </Suspense>
  );
}
