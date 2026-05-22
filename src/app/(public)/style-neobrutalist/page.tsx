"use client";

import Link from "next/link";
import { ArrowRight, ArrowRightCircle, ToyBrick } from "lucide-react";

export default function NeoBrutalistBlogPage() {
  return (
    <div className="min-h-screen text-black bg-[#f4f1eb] selection:bg-[#2DD4BF] selection:text-black font-sans pb-16 antialiased">
      {/* Google Fonts and CSS Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Lexend+Deca:wght@300;400;500;700;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

        .font-sans-brutal {
          font-family: 'Lexend Deca', sans-serif;
        }
        .font-mono-brutal {
          font-family: 'Space Mono', monospace;
        }
        .brutal-border {
          border: 3px solid #000000 !important;
        }
        .brutal-border-b {
          border-bottom: 4px solid #000000 !important;
        }
        .brutal-border-t {
          border-top: 3px solid #000000 !important;
        }
        .brutal-border-t-2 {
          border-top: 2px solid #000000 !important;
        }
        .brutal-shadow {
          box-shadow: 6px 6px 0px 0px #000000 !important;
        }
        .brutal-shadow-hover {
          transition: all 0.15s ease-out;
        }
        .brutal-shadow-hover:hover {
          transform: translate(-3px, -3px);
          box-shadow: 9px 9px 0px 0px #000000 !important;
        }
        .brutal-shadow-hover:active {
          transform: translate(3px, 3px);
          box-shadow: 3px 3px 0px 0px #000000 !important;
        }
      `}} />

      {/* Header */}
      <header className="brutal-border-b bg-white py-5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#A3E635] brutal-border brutal-shadow flex items-center justify-center font-black text-lg">
              R
            </div>
            <span className="font-sans-brutal font-black text-2xl tracking-tighter uppercase">RETRO_FLOW.</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 font-bold uppercase text-sm tracking-wider font-sans-brutal">
            <Link href="#" className="px-3 py-1.5 bg-[#FDE047] brutal-border brutal-shadow hover:translate-y-[-2px] transition-transform">Index</Link>
            <Link href="#" className="px-3 py-1.5 hover:bg-[#2DD4BF] brutal-border transition-colors">Developer_Log</Link>
            <Link href="#" className="px-3 py-1.5 hover:bg-[#C084FC] brutal-border transition-colors">Showcases</Link>
          </nav>

          <div className="flex items-center gap-4">
            <button className="font-sans-brutal font-bold text-xs uppercase bg-[#F87171] brutal-border brutal-shadow px-4 py-2 hover:translate-y-[-2px] transition-transform">
              Connect_Node
            </button>
          </div>
        </div>
      </header>

      {/* Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 font-sans-brutal">

        {/* Welcome Strip */}
        <div className="bg-[#2DD4BF] brutal-border brutal-shadow p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="font-mono-brutal text-xs uppercase font-bold px-2 py-0.5 bg-black text-white rounded">SYSTEM_ANNOUNCEMENT</span>
            <h2 className="text-2xl font-black tracking-tight">{"// 欢迎来到自主终端：本站全部设计使用极具张力的 Neo-Brutalist 风格拼装！"}</h2>
          </div>
          <div className="flex gap-3">
            <button className="bg-white brutal-border px-4 py-2 font-black text-sm brutal-shadow hover:translate-y-[-2px] transition-transform">READ_MISSION</button>
            <button className="bg-[#FDE047] brutal-border px-4 py-2 font-black text-sm brutal-shadow hover:translate-y-[-2px] transition-transform">GITHUB_CLI</button>
          </div>
        </div>

        {/* Featured Mega Card */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left side: Big Featured Card (8 cols) */}
          <div className="lg:col-span-8 bg-white brutal-border brutal-shadow p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="bg-[#C084FC] font-mono-brutal text-xs font-bold px-2.5 py-1 brutal-border">WEB_ARCHITECTURE</span>
                <span className="font-mono-brutal text-xs font-semibold text-slate-500">05.23.2026 // 12 MIN READ</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none uppercase">
                打破完美圆角：新野兽派 Web 设计在精细化审美疲劳下的暴力突围
              </h1>

              <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-medium">
                当所有的 SaaS 官网都长着一模一样的 Tailwind 渐变、浮夸的软阴影和极致的无缝圆角时，硬核的、方正的、粗糙的 Neo-Brutalist 风格正在重新占领开发者的个人博客。本文全面拆解这一风格的设计要素，包括实色阴影、高对比描边以及非对称色块的组装……
              </p>
            </div>

            <div className="pt-6 brutal-border-t flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#FDE047] brutal-border flex items-center justify-center font-bold text-lg">A</div>
                <div>
                  <h4 className="font-black text-sm uppercase">ANTIGRAVITY_BOT</h4>
                  <p className="font-mono-brutal text-[10px] text-slate-500">SYS_CO_PILOT</p>
                </div>
              </div>
              <button className="bg-[#2DD4BF] brutal-border brutal-shadow-hover px-5 py-2.5 font-black text-sm uppercase flex items-center gap-2">
                Compile_Log <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right side: Big Graphic Box (4 cols) */}
          <div className="lg:col-span-4 bg-[#FDE047] brutal-border brutal-shadow p-6 flex flex-col items-center justify-center text-center space-y-4">
            <ToyBrick className="h-28 w-28 text-black animate-bounce" />
            <h3 className="text-2xl font-black uppercase">BRICK_BUILDER</h3>
            <p className="font-mono-brutal text-xs text-black/80 max-w-xs">
              模块化，刚性线条，强交互。我们通过对基本拼块的叠加，打破传统网格的刻板印象。
            </p>
            <span className="font-mono-brutal text-[10px] font-bold border-2 border-black bg-white px-2 py-1">MATRIX_SYNCED // ON</span>
          </div>

        </section>

        {/* Grid Stream */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

          {/* Card 1 */}
          <article className="bg-white brutal-border brutal-shadow brutal-shadow-hover p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="bg-[#A3E635] font-mono-brutal text-[10px] font-bold px-2 py-0.5 brutal-border">DOCKER</span>
                <span className="font-mono-brutal text-[10px] text-slate-500">05.22.2026</span>
              </div>
              <h3 className="text-xl font-black uppercase line-clamp-2 hover:underline">
                单点突破：将 Docker 大文件压缩至 20MB 的超频精简指南
              </h3>
              <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-3">
                使用 Distroless、多阶段构建以及 UPX 压缩编译二进制包，完美减少服务器开销的底层测试。
              </p>
            </div>
            <div className="pt-4 brutal-border-t-2 flex justify-between items-center text-xs">
              <span className="font-mono-brutal font-bold">5 MINS // READ</span>
              <ArrowRightCircle className="h-5 w-5 text-black" />
            </div>
          </article>

          {/* Card 2 */}
          <article className="bg-white brutal-border brutal-shadow brutal-shadow-hover p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="bg-[#F87171] font-mono-brutal text-[10px] font-bold px-2 py-0.5 brutal-border">NEXTJS</span>
                <span className="font-mono-brutal text-[10px] text-slate-500">05.20.2026</span>
              </div>
              <h3 className="text-xl font-black uppercase line-clamp-2 hover:underline">
                全栈提速：基于 Prisma 边缘调用的超凡数据库缓存路由
              </h3>
              <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-3">
                使用 Cloudflare Workers 代理加上 Prisma 加速服务，将冷启动延时优化到惊人的 15ms 级。
              </p>
            </div>
            <div className="pt-4 brutal-border-t-2 flex justify-between items-center text-xs">
              <span className="font-mono-brutal font-bold">8 MINS // READ</span>
              <ArrowRightCircle className="h-5 w-5 text-black" />
            </div>
          </article>

          {/* Card 3 */}
          <article className="bg-white brutal-border brutal-shadow brutal-shadow-hover p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="bg-[#C084FC] font-mono-brutal text-[10px] font-bold px-2 py-0.5 brutal-border">DEVOPS</span>
                <span className="font-mono-brutal text-[10px] text-slate-500">05.18.2026</span>
              </div>
              <h3 className="text-xl font-black uppercase line-clamp-2 hover:underline">
                自动化审判：使用 Github Actions 实现 100% 覆盖的静态 Lint 检测
              </h3>
              <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-3">
                定制一套极度严格的校验工作流，所有未通过 ESLint / Prettier 规范的代码将被直接打回并封锁合并路径。
              </p>
            </div>
            <div className="pt-4 brutal-border-t-2 flex justify-between items-center text-xs">
              <span className="font-mono-brutal font-bold">11 MINS // READ</span>
              <ArrowRightCircle className="h-5 w-5 text-black" />
            </div>
          </article>

        </section>

        {/* Bottom Widgets: Tags & Newsletter (2 Columns) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Tags */}
          <div className="bg-white brutal-border brutal-shadow p-6 space-y-4">
            <h4 className="text-lg font-black uppercase font-mono-brutal">{"// TAG_COLLECTION"}</h4>
            <div className="flex flex-wrap gap-3 font-mono-brutal">
              <Link href="#" className="font-bold text-xs bg-[#A3E635] brutal-border px-3 py-1.5 hover:translate-y-[-2px] transition-transform">#DOCKER (2)</Link>
              <Link href="#" className="font-bold text-xs bg-[#FDE047] brutal-border px-3 py-1.5 hover:translate-y-[-2px] transition-transform">#NEXTJS (12)</Link>
              <Link href="#" className="font-bold text-xs bg-[#F87171] brutal-border px-3 py-1.5 hover:translate-y-[-2px] transition-transform">#WEB设计 (8)</Link>
              <Link href="#" className="font-bold text-xs bg-[#2DD4BF] brutal-border px-3 py-1.5 hover:translate-y-[-2px] transition-transform">#DEVOPS (4)</Link>
              <Link href="#" className="font-bold text-xs bg-[#C084FC] brutal-border px-3 py-1.5 hover:translate-y-[-2px] transition-transform">#PRISMA (15)</Link>
            </div>
          </div>

          {/* Newsletter */}
          <div className="bg-[#FDE047] brutal-border brutal-shadow p-6 space-y-4">
            <h4 className="text-lg font-black uppercase font-mono-brutal">{"// LINK_NEWSLETTER"}</h4>
            <p className="text-xs font-semibold leading-relaxed">
              订阅我们的终端更新流。当有新的技术进化包发布时，你将收到第一声警报。
            </p>
            <div className="flex gap-2">
              <input type="text" placeholder="ENTER_EMAIL_GATE" className="flex-1 brutal-border px-3 py-2 text-xs font-mono-brutal focus:outline-none focus:ring-1 focus:ring-black" />
              <button className="bg-black text-white brutal-border px-4 py-2 font-black text-xs uppercase hover:bg-[#F87171] transition-colors">JOIN</button>
            </div>
          </div>

        </section>

      </main>

      {/* Footer */}
      <footer className="brutal-border-t bg-white py-8 text-center text-xs font-black uppercase font-mono-brutal">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>© 2026 RETRO_FLOW. PROTECTION_OFFLINE_READY</p>
          <p className="text-xs text-slate-500">{"// STYLING BY ANTIGRAVITY CO_PILOT"}</p>
        </div>
      </footer>
    </div>
  );
}
