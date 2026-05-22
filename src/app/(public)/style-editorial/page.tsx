"use client";

import Link from "next/link";
import { ArrowUpRight, Search, Clock } from "lucide-react";

export default function EditorialBlogPage() {
  return (
    <div className="min-h-screen text-[#121212] bg-[#faf9f6] selection:bg-[#121212] selection:text-[#faf9f6] font-sans pb-16 antialiased">
      {/* Google Fonts and CSS Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

        .font-serif-editorial {
          font-family: 'Playfair Display', serif;
        }
        .font-sans-editorial {
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
      `}} />

      {/* Minimal Header */}
      <header className="border-b border-[#121212]/10 py-6 sticky top-0 bg-[#faf9f6]/95 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="font-serif-editorial italic text-3xl font-extrabold tracking-tight">The</span>
            <span className="font-sans-editorial text-xl font-bold uppercase tracking-[0.2em]">Journal.</span>
          </div>

          <nav className="hidden md:flex items-center gap-10 text-xs font-semibold uppercase tracking-widest text-[#707070]">
            <Link href="#" className="text-[#121212] hover:text-[#a88f70] transition-colors">Index</Link>
            <Link href="#" className="hover:text-[#121212] hover:text-[#a88f70] transition-colors">Essays</Link>
            <Link href="#" className="hover:text-[#121212] hover:text-[#a88f70] transition-colors">Portfolios</Link>
            <Link href="#" className="hover:text-[#121212] hover:text-[#a88f70] transition-colors">Conversations</Link>
          </nav>

          <div className="flex items-center gap-6">
            <Link href="#" className="text-xs font-semibold uppercase tracking-wider hover:underline flex items-center gap-1">
              <Search className="h-3.5 w-3.5" /> Search
            </Link>
            <Link href="#" className="hidden sm:inline-block text-xs font-semibold uppercase tracking-wider bg-[#121212] text-[#faf9f6] px-5 py-2.5 hover:bg-[#a88f70] transition-colors">
              Subscribe
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid Wrapper */}
      <main className="max-w-7xl mx-auto px-6 py-12">

        {/* Hero / Featured Banner (Asymmetric 2-Column Grid) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-16 border-b border-[#121212]/10">

          {/* Featured Description (8 columns) */}
          <div className="lg:col-span-8 flex flex-col justify-between space-y-8 pr-0 lg:pr-8">
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-widest text-[#707070]">
                <span>Featured Essay</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#a88f70]"></span>
                <span>Architectural Philosophy</span>
              </div>

              <h1 className="font-serif-editorial text-4xl sm:text-6xl lg:text-7xl font-normal leading-[1.08] tracking-tight text-[#121212]">
                理性的容器：现代主义建筑在极简秩序下的美学自白
              </h1>

              <p className="text-[#707070] text-base sm:text-lg leading-relaxed font-light max-w-2xl">
                当装饰被剥离，比例与材料本身便承担了叙事。本文重访了包豪斯学派与路德维希·密斯·凡德罗的“少即是多”原则，探讨纯粹几何形体是如何在淡漠的空间中制造深邃的精神归宿……
              </p>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-[#121212]/10">
              <div className="flex items-center gap-3">
                <span className="font-sans-editorial text-xs uppercase tracking-widest text-[#121212] font-bold">WRITTEN BY ROY DUST</span>
                <span className="text-xs text-[#707070]">— 05.23.2026</span>
              </div>
              <Link href="#" className="text-xs uppercase font-semibold tracking-widest text-[#121212] hover:text-[#a88f70] transition-colors flex items-center gap-2">
                Read Essay <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Monochrome Abstract Graphic (4 columns) */}
          <div className="lg:col-span-4 flex items-center justify-center">
            <div className="w-full aspect-[4/5] bg-[#e5e5e0] relative overflow-hidden group">
              {/* Geometric Line Art mimicking Minimal architecture */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 z-10"></div>
              <div className="absolute inset-0 flex items-center justify-center z-0 p-8">
                <svg viewBox="0 0 100 100" className="w-full h-full stroke-[#121212]/20 fill-none stroke-[0.5] transform group-hover:scale-105 transition-transform duration-700">
                  <rect x="15" y="15" width="70" height="70" />
                  <line x1="15" y1="50" x2="85" y2="50" />
                  <line x1="50" y1="15" x2="50" y2="85" />
                  <circle cx="50" cy="50" r="25" className="stroke-[#a88f70]/60 stroke-[1.5]" />
                </svg>
              </div>
              <div className="absolute bottom-6 left-6 z-20">
                <span className="font-serif-editorial italic text-sm text-[#121212]">Fig 1. Bauhaus Geometric Balance</span>
              </div>
            </div>
          </div>

        </section>

        {/* Mid Section: Multi-Column Typographic Feed */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 py-16">

          {/* Left Column: Main Articles stream (8 cols) */}
          <div className="lg:col-span-8 space-y-12">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#707070] mb-8 flex items-center gap-3">
              Latest Publications
              <span className="flex-1 h-[0.5px] bg-[#121212]/10"></span>
            </h2>

            {/* Article List (Swiss Minimal Style) */}
            <div className="divide-y divide-[#121212]/10">

              {/* Article 1 */}
              <article className="py-8 first:pt-0 group">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-baseline">
                  <div className="sm:col-span-3 text-xs text-[#707070] font-semibold uppercase tracking-wider font-mono">
                    05.21.2026 // ESSAY
                  </div>
                  <div className="sm:col-span-9 space-y-3">
                    <h3 className="font-serif-editorial text-xl sm:text-2xl font-bold group-hover:text-[#a88f70] transition-colors">
                      时间的刻度：关于机械表齿轮传动与流体力学的极简沉思
                    </h3>
                    <p className="text-sm text-[#707070] leading-relaxed font-light line-clamp-2">
                      陀飞轮的引力补偿机制不仅仅是微米级制造的胜利，它更是牛顿力学在静态钟表面上进行的长达数个世纪的宏大演绎……
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      <Link href="#" className="text-xs font-bold uppercase tracking-widest text-[#121212] hover:text-[#a88f70] transition-colors">
                        Read More
                      </Link>
                      <span className="text-xs text-[#707070] font-light flex items-center gap-2">
                        <Clock className="h-3 w-3" /> 6 MINUTE READ // 1.2K READS
                      </span>
                    </div>
                  </div>
                </div>
              </article>

              {/* Article 2 */}
              <article className="py-8 group">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-baseline">
                  <div className="sm:col-span-3 text-xs text-[#707070] font-semibold uppercase tracking-wider font-mono">
                    05.18.2026 // DESIGN
                  </div>
                  <div className="sm:col-span-9 space-y-3">
                    <h3 className="font-serif-editorial text-xl sm:text-2xl font-bold group-hover:text-[#a88f70] transition-colors">
                      瑞士风格网格：从无衬线体到绝对版面几何的视觉革命
                    </h3>
                    <p className="text-sm text-[#707070] leading-relaxed font-light line-clamp-2">
                      分析埃米尔·鲁德与阿明·霍夫曼的排版准则。严谨的数学比例如何赋予多语言排版不可撼动的建筑感结构，实现跨国界无障碍交流。
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      <Link href="#" className="text-xs font-bold uppercase tracking-widest text-[#121212] hover:text-[#a88f70] transition-colors">
                        Read More
                      </Link>
                      <span className="text-xs text-[#707070] font-light flex items-center gap-2">
                        <Clock className="h-3 w-3" /> 9 MINUTE READ // 3.4K READS
                      </span>
                    </div>
                  </div>
                </div>
              </article>

              {/* Article 3 */}
              <article className="py-8 group">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-baseline">
                  <div className="sm:col-span-3 text-xs text-[#707070] font-semibold uppercase tracking-wider font-mono">
                    05.15.2026 // PHILOSOPHY
                  </div>
                  <div className="sm:col-span-9 space-y-3">
                    <h3 className="font-serif-editorial text-xl sm:text-2xl font-bold group-hover:text-[#a88f70] transition-colors">
                      无意识心理学：弗洛伊德对梦境拓扑结构的几何解析
                    </h3>
                    <p className="text-sm text-[#707070] leading-relaxed font-light line-clamp-2">
                      将梦境中扭曲的时间线与心理防御机制解构为高维空间中的拓扑折叠，借用数学隐喻重新阐释古典精神分析框架。
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      <Link href="#" className="text-xs font-bold uppercase tracking-widest text-[#121212] hover:text-[#a88f70] transition-colors">
                        Read More
                      </Link>
                      <span className="text-xs text-[#707070] font-light flex items-center gap-2">
                        <Clock className="h-3 w-3" /> 14 MINUTE READ // 980 READS
                      </span>
                    </div>
                  </div>
                </div>
              </article>

            </div>

            {/* Classic Page Indicator */}
            <div className="pt-8 border-t border-[#121212]/10 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-[#707070]">
              <Link href="#" className="hover:text-[#121212] transition-colors">← Previous Index</Link>
              <span className="text-[#121212]">Page 01 of 08</span>
              <Link href="#" className="hover:text-[#121212] transition-colors">Next Index →</Link>
            </div>
          </div>

          {/* Right Column: Sidebar / editorial details (4 cols) */}
          <aside className="lg:col-span-4 lg:pl-12 space-y-12">

            {/* Sidebar Segment 1: Journal Mandate */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#707070]">
                The Mandate
              </h4>
              <p className="font-serif-editorial italic text-lg leading-relaxed text-[#121212]">
                “我们追求思考的深层对称。在喧嚣的信息洪流中，为理性保留一处静默的、合乎度量衡的归宿。”
              </p>
              <div className="h-[0.5px] bg-[#121212]/10 w-1/3"></div>
            </div>

            {/* Sidebar Segment 2: Indexes Tags */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#707070]">
                Indices
              </h4>
              <ul className="space-y-3 text-xs uppercase tracking-wider font-semibold">
                <li>
                  <Link href="#" className="flex justify-between items-baseline group hover:text-[#a88f70] transition-colors">
                    <span>Architecture</span>
                    <span className="flex-1 mx-2 border-b border-dotted border-[#121212]/20"></span>
                    <span className="text-[#707070] font-normal">(12)</span>
                  </Link>
                </li>
                <li>
                  <Link href="#" className="flex justify-between items-baseline group hover:text-[#a88f70] transition-colors">
                    <span>Typography</span>
                    <span className="flex-1 mx-2 border-b border-dotted border-[#121212]/20"></span>
                    <span className="text-[#707070] font-normal">(18)</span>
                  </Link>
                </li>
                <li>
                  <Link href="#" className="flex justify-between items-baseline group hover:text-[#a88f70] transition-colors">
                    <span>Chronometry</span>
                    <span className="flex-1 mx-2 border-b border-dotted border-[#121212]/20"></span>
                    <span className="text-[#707070] font-normal">(7)</span>
                  </Link>
                </li>
                <li>
                  <Link href="#" className="flex justify-between items-baseline group hover:text-[#a88f70] transition-colors">
                    <span>Psychoanalysis</span>
                    <span className="flex-1 mx-2 border-b border-dotted border-[#121212]/20"></span>
                    <span className="text-[#707070] font-normal">(14)</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Sidebar Segment 3: Editorial Office */}
            <div className="space-y-4 pt-6 border-t border-[#121212]/10">
              <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#707070]">
                Office Contacts
              </h4>
              <div className="text-xs text-[#707070] space-y-2 font-mono leading-relaxed">
                <p>EDITORIAL DEP. SHANGHAI // TONY DUST</p>
                <p>LETTERS TO: <a href="mailto:office@thejournal.design" className="underline hover:text-[#a88f70]">OFFICE@THEJOURNAL.DESIGN</a></p>
              </div>
            </div>

          </aside>

        </section>

      </main>

      {/* Minimalist footer */}
      <footer className="border-t border-[#121212]/10 py-12 bg-[#faf9f6] text-xs text-[#707070] tracking-wider uppercase font-semibold">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-baseline gap-1">
            <span className="font-serif-editorial italic text-base lowercase">the</span>
            <span className="font-sans-editorial text-xs tracking-widest font-black text-[#121212]">Journal.</span>
          </div>
          <div>
            <p>© 2026 THE JOURNAL DESIGN. ALL RIGHTS RESERVED.</p>
          </div>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-[#121212] transition-colors">Instagram</Link>
            <Link href="#" className="hover:text-[#121212] transition-colors">RSS Feed</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
