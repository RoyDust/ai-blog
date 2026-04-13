"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenText, Folder, Github, Mail, Tag, Twitter } from "lucide-react";
import { FallbackImage } from "@/components/ui";

const profile = {
  name: "RoyDust",
  avatar: "https://avatars.githubusercontent.com/u/50167909",
  bio: "全栈开发者，热爱开源和技术分享，专注于 React 生态与现代 Web 开发。",
  links: [
    { name: "GitHub", url: "https://github.com/RoyDust", icon: Github },
    { name: "Twitter", url: "https://x.com/luoyichen12", icon: Twitter },
    { name: "Email", url: "mailto:roydust@foxmail.com", icon: Mail },
  ],
};

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  _count?: { posts?: number };
};

type TagItem = {
  id: string;
  name: string;
  slug: string;
};

export function Sidebar() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadTaxonomy = async () => {
      try {
        const [categoriesRes, tagsRes] = await Promise.all([fetch("/api/categories"), fetch("/api/tags")]);
        const [categoriesJson, tagsJson] = await Promise.all([categoriesRes.json(), tagsRes.json()]);

        if (!isMounted) return;

        setCategories(Array.isArray(categoriesJson?.data) ? categoriesJson.data : []);
        setTags(Array.isArray(tagsJson?.data) ? tagsJson.data : []);
      } catch {
        if (!isMounted) return;
        setCategories([]);
        setTags([]);
      }
    };

    void loadTaxonomy();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <aside id="sidebar" className="onload-animation h-full w-[17.5rem] shrink-0">
      <div className="flex h-full flex-col gap-4">
        <div className="card-base p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 h-24 w-24 overflow-hidden rounded-full ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--card-bg)]">
              <FallbackImage alt={profile.name} className="object-cover" fill sizes="96px" src={profile.avatar} />
            </div>
            <h2 className="text-90 mb-2 text-xl font-bold">{profile.name}</h2>
            <p className="text-75 mb-4 text-sm leading-relaxed">{profile.bio}</p>
            <div className="flex gap-2">
              {profile.links.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.name}
                    aria-label={link.name}
                    className="btn-plain scale-animation h-9 w-9 rounded-lg"
                    href={link.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <div
            data-testid="sidebar-taxonomy-rail"
            className="sticky space-y-4 overflow-y-auto pr-1 pt-1 transition-[top,max-height,transform,box-shadow] duration-300 ease-out will-change-[top,transform]"
            style={{
              top: "calc(var(--sidebar-sticky-top, 0px) + 0.75rem)",
              maxHeight: "calc(100vh - var(--sidebar-sticky-top, 0px) - 1.75rem)",
            }}
          >
            <div className="card-base p-5">
              <div className="mb-3 flex items-center gap-2">
                <BookOpenText className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="text-90 font-bold">继续探索</h3>
              </div>
              <div className="space-y-2">
                <Link className="text-75 block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--btn-plain-bg-hover)]" href="/posts">
                  浏览全部文章
                </Link>
                <Link className="text-75 block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--btn-plain-bg-hover)]" href="/search">
                  搜索主题或关键词
                </Link>
                <Link className="text-75 block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--btn-plain-bg-hover)]" href="/archives">
                  按时间回看归档
                </Link>
              </div>
            </div>

            <div className="card-base p-6">
              <div className="mb-4 flex items-center gap-2">
                <Folder className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="text-90 font-bold">分类索引</h3>
              </div>
              <div className="space-y-2">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-[var(--btn-plain-bg-hover)]"
                    href={`/categories/${category.slug}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                      <span className="text-75 text-sm">{category.name}</span>
                    </div>
                    <span className="text-50 text-xs">{category._count?.posts ?? 0}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card-base p-6">
              <div className="mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="text-90 font-bold">标签地图</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link key={tag.id} className="ui-chip" href={`/tags/${tag.slug}`}>
                    {tag.name}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/archives" className="card-base flex items-center justify-between p-4 transition hover:bg-[var(--btn-card-bg-hover)]">
              <span className="text-75 font-medium">文章归档</span>
              <span className="text-50 text-sm">查看全部 →</span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
