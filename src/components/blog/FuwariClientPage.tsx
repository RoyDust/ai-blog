"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Calendar,
  Folder,
  Tag,
  Search,
  Github,
  Twitter,
  Mail,
  BookOpen,
  ChevronRight,
  Sparkles,
  Clock
} from "lucide-react";

interface PublicPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  createdAt: string;
  readingTimeMinutes: number;
  viewCount: number;
  category: {
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    name: string;
    slug: string;
  }>;
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  _count: {
    posts: number;
  };
}

interface TagItem {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  _count: {
    posts: number;
  };
}

interface BlogSettings {
  siteName: string;
  siteDescription: string;
  profile: {
    subtitle: string;
    tagline: string;
    bio: string;
    githubUrl: string;
    twitterUrl: string;
  };
}

interface FuwariClientPageProps {
  posts: PublicPost[];
  categories: CategoryItem[];
  tags: TagItem[];
  settings: BlogSettings;
}

export default function FuwariClientPage({ posts, categories, tags, settings }: FuwariClientPageProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredArticles = posts.filter(art => {
    // 1. Filter by category
    if (activeCategory !== "All") {
      if (art.category?.slug !== activeCategory) {
        return false;
      }
    }
    // 2. Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const titleMatch = art.title.toLowerCase().includes(query);
      const excerptMatch = art.excerpt?.toLowerCase().includes(query) ?? false;
      const tagMatch = art.tags.some(t => t.name.toLowerCase().includes(query));
      if (!titleMatch && !excerptMatch && !tagMatch) {
        return false;
      }
    }
    return true;
  });

  const getTagColorClass = (tagSlug: string) => {
    const hash = tagSlug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
      "bg-sky-50 text-sky-600 hover:bg-sky-100",
      "bg-orange-50 text-orange-600 hover:bg-orange-100",
      "bg-blue-50 text-blue-600 hover:bg-blue-100",
      "bg-cyan-50 text-cyan-600 hover:bg-cyan-100",
      "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
      "bg-amber-50 text-amber-600 hover:bg-amber-100",
      "bg-rose-50 text-rose-600 hover:bg-rose-100",
      "bg-violet-50 text-violet-600 hover:bg-violet-100"
    ];
    return colors[hash % colors.length];
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen text-[#2e2e2e] bg-[#f4f6f9] selection:bg-indigo-100 selection:text-indigo-900 font-sans pb-16 antialiased">
      {/* Google Fonts and CSS Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

        .font-outfit {
          font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif;
        }
        .font-sans-fuwari {
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .font-mono-fuwari {
          font-family: 'Space Mono', monospace;
        }
      `}} />

      {/* Floating Island Navigation Header */}
      <div className="max-w-6xl mx-auto px-4 pt-4 sticky top-0 z-50">
        <header className="px-6 py-3.5 bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200 hover:scale-105 transition-transform">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
            </Link>
            <span className="font-outfit font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-indigo-700 bg-clip-text text-transparent">Fuwari.</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 font-sans-fuwari">
            <Link href="/" className="hover:text-indigo-600 transition-colors">博客主页</Link>
            <Link href="/archives" className="hover:text-indigo-600 transition-colors">归档</Link>
            <Link href="/about" className="hover:text-indigo-600 transition-colors">关于我</Link>
            <Link href="/admin" className="hover:text-indigo-600 transition-colors">管理后台</Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索文章..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 sm:w-48 bg-slate-100 hover:bg-slate-200/80 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-1.5 pl-8 text-xs font-medium outline-none transition-all"
              />
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            {settings.profile.githubUrl && (
              <a
                href={settings.profile.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors"
              >
                <Github className="h-4 w-4 text-slate-700" />
              </a>
            )}
          </div>
        </header>
      </div>

      {/* Hero Banner Header Container */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="relative w-full h-[260px] md:h-[320px] rounded-3xl overflow-hidden shadow-sm">
          <img
            src="/images/fuwari_banner.png"
            alt="Fuwari Banner"
            className="absolute inset-0 w-full h-full object-cover transform scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent"></div>

          <div className="absolute bottom-16 left-6 md:left-10 text-white space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-extrabold px-2 py-0.5 bg-indigo-600 rounded-md font-outfit shadow-sm">REALTIME_DATABASE</span>
              <span className="text-xs opacity-75 font-mono-fuwari">{"// SYNC_ONLINE"}</span>
            </div>
            <h1 className="font-outfit font-extrabold text-3xl md:text-5xl tracking-tight leading-tight">
              {settings.siteName}
            </h1>
            <p className="text-slate-200 text-sm md:text-base font-light max-w-xl line-clamp-2">
              {settings.siteDescription}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative -mt-6 z-20">

        {/* Left Column: Articles Stream (8 cols) */}
        <section className="lg:col-span-8 space-y-6">

          {/* Header Area inside columns */}
          <div className="flex items-center justify-between bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200/50 shadow-sm text-sm font-sans-fuwari">
            <span className="font-bold text-slate-700 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              项目真实文章 ({filteredArticles.length})
            </span>

            <div className="flex gap-1.5">
              <button
                onClick={() => setActiveCategory("All")}
                className={`px-3 py-1 rounded-xl font-semibold text-xs transition-all ${
                  activeCategory === "All"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100/80 hover:bg-slate-200/80 text-slate-600"
                }`}
              >
                全部
              </button>
              {categories.slice(0, 3).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`px-3 py-1 rounded-xl font-semibold text-xs transition-all ${
                    activeCategory === cat.slug
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100/80 hover:bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Articles Render */}
          {filteredArticles.length > 0 ? (
            filteredArticles.map((art) => (
              <article
                key={art.id}
                className="bg-white hover:bg-slate-50/50 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.035)] transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 font-sans-fuwari">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" /> {formatDate(art.createdAt)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg">
                      <Folder className="h-3 w-3" /> {art.category?.name ?? "未分类"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-indigo-400" /> {art.readingTimeMinutes} 分钟阅读
                    </span>
                  </div>

                  <Link href={`/posts/${art.slug}`} className="block">
                    <h2 className="font-outfit font-extrabold text-xl md:text-2xl text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight">
                      {art.title}
                    </h2>
                  </Link>

                  <p className="text-slate-500 text-sm md:text-base leading-relaxed font-light font-sans-fuwari line-clamp-3">
                    {art.excerpt || "暂无文章导读。点击“阅读全文”查看文章完整内容……"}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {art.tags.map((tag) => (
                      <span
                        key={tag.slug}
                        className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-xl font-medium font-sans-fuwari transition-colors cursor-pointer ${getTagColorClass(tag.slug)}`}
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>

                  <Link href={`/posts/${art.slug}`} className="font-sans-fuwari font-bold text-xs uppercase tracking-wider text-indigo-600 group-hover:text-indigo-700 flex items-center gap-1 transition-colors">
                    阅读全文 <ChevronRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-100 font-sans-fuwari shadow-sm">
              <Sparkles className="h-8 w-8 text-indigo-300 mx-auto mb-3 animate-bounce" />
              <p>这里空空如也，没有找到匹配当前筛选的文章。</p>
            </div>
          )}

        </section>

        {/* Right Column: Sidebar (4 cols) */}
        <aside className="lg:col-span-4 space-y-6">

          {/* Profile Card */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100 flex flex-col items-center text-center font-sans-fuwari">
            <div className="relative group mb-4">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-sky-400 rounded-full blur-md opacity-25 group-hover:opacity-40 transition-opacity duration-300"></div>
              <img
                src="/images/avatar_developer.png"
                alt="Avatar"
                className="relative w-24 h-24 rounded-full border-4 border-white shadow-sm object-cover"
              />
            </div>

            <h3 className="font-outfit font-extrabold text-xl text-slate-800">Roy Dust</h3>
            <p className="text-slate-400 text-xs font-mono-fuwari mt-0.5">
              {"// "}
              {settings.profile.subtitle || "MINIMALIST DEVELOPER"}
            </p>

            <p className="text-slate-500 text-sm font-light mt-3 leading-relaxed">
              {settings.profile.bio || "热衷于打磨人机交互的终极平衡。在克制与诗意之间，留存技术演进的细枝末节。"}
            </p>

            {/* Stats Block */}
            <div className="grid grid-cols-3 gap-6 w-full py-4 my-4 border-y border-slate-100 text-center">
              <div>
                <span className="block font-outfit font-extrabold text-lg text-slate-800">{posts.length}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">文章</span>
              </div>
              <div>
                <span className="block font-outfit font-extrabold text-lg text-slate-800">{categories.length}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">分类</span>
              </div>
              <div>
                <span className="block font-outfit font-extrabold text-lg text-slate-800">{tags.length}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">标签</span>
              </div>
            </div>

            {/* Contact channels */}
            <div className="flex gap-3 justify-center w-full">
              {settings.profile.githubUrl && (
                <a href={settings.profile.githubUrl} target="_blank" rel="noopener noreferrer" className="h-9 w-9 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center transition-colors">
                  <Github className="h-4 w-4" />
                </a>
              )}
              {settings.profile.twitterUrl && (
                <a href={settings.profile.twitterUrl} target="_blank" rel="noopener noreferrer" className="h-9 w-9 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center transition-colors">
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              <Link href="/about" className="h-9 w-9 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center transition-colors">
                <Mail className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Categories Card */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100 font-sans-fuwari">
            <h4 className="font-outfit font-extrabold text-sm uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Folder className="h-4 w-4 text-indigo-500" />
              全部分类
            </h4>
            <div className="space-y-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all group ${
                    activeCategory === cat.slug
                      ? "bg-indigo-50 text-indigo-600"
                      : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className={`h-3.5 w-3.5 text-indigo-400 transform transition-transform ${
                      activeCategory === cat.slug ? "translate-x-0.5" : "opacity-0 group-hover:opacity-100"
                    }`} />
                    {cat.name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-bold font-mono-fuwari ${
                    activeCategory === cat.slug
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {cat._count.posts}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tag Cloud Card */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-slate-100 font-sans-fuwari">
            <h4 className="font-outfit font-extrabold text-sm uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Tag className="h-4 w-4 text-indigo-500" />
              热门标签
            </h4>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  onClick={() => setSearchQuery(tag.name)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 shadow-[0_2px_4px_rgba(0,0,0,0.01)] hover:shadow-sm ${getTagColorClass(tag.slug)}`}
                >
                  #{tag.name} ({tag._count.posts})
                </span>
              ))}
            </div>
          </div>

        </aside>

      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 mt-12 text-center text-xs text-slate-400 font-sans-fuwari">
        <div className="border-t border-slate-200/60 pt-8 space-y-2">
          <p>© 2026 {settings.siteName}. ALL RIGHTS RESERVED.</p>
          <p className="flex items-center justify-center gap-1 font-mono-fuwari">
            DATABASE SYNCED // POWERED BY NEXT.JS & PRISMA <Sparkles className="h-3 w-3 text-indigo-500" />
          </p>
        </div>
      </footer>
    </div>
  );
}
