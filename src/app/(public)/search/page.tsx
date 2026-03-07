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

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setPosts([]);
      setError(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

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
          setPosts(data.data);
        }
      })
      .catch((requestError: Error) => {
        if (alive) {
          setPosts([]);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="ui-surface rounded-2xl p-6">
        <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">搜索结果</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">输入关键词，搜索文章标题、摘要、正文、标签与分类。</p>
        <div className="mt-4">
          <SearchForm defaultValue={query} />
        </div>
      </section>

      {loading ? <p className="py-12 text-center text-[var(--muted)]">正在搜索...</p> : null}
      {error ? <p className="py-12 text-center text-red-500">{error}</p> : null}

      {!loading && !error && query && posts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {posts.map((post) => (
            <SearchResultCard key={post.id} post={post} query={query} />
          ))}
        </div>
      ) : null}

      {!loading && !error ? (
        <p className="py-12 text-center text-[var(--muted)]">{query ? (posts.length === 0 ? "未找到相关结果" : `找到 ${posts.length} 条结果`) : "请输入关键词开始搜索"}</p>
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
