"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PostCard } from "@/components/blog";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
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
  const query = searchParams.get("q") || "";
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!query) {
      return;
    }

    let alive = true;
    fetch(`/api/posts?search=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        if (alive && data.success) {
          setPosts(data.data);
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
        <p className="mt-2 text-sm text-[var(--muted)]">关键词: {query || "未输入"}</p>
      </section>

      {query && posts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-[var(--muted)]">{query ? "未找到相关结果" : "请输入关键词开始搜索"}</p>
      )}
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


