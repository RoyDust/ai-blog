"use client";

import Link from "next/link";
import { Cpu, ArrowRight, BrainCircuit, Server, Hash } from "lucide-react";

export default function CyberpunkBlogPage() {
  return (
    <div className="min-h-screen text-slate-200 relative selection:bg-[#66fcf1] selection:text-black font-sans pb-16 overflow-hidden">
      {/* Google Fonts and CSS Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@500;700;900&display=swap');

        .font-cyber {
          font-family: 'Orbitron', 'Inter', sans-serif;
        }
        .cyber-bg {
          background: radial-gradient(circle at 50% 50%, #11101d 0%, #07070c 100%) !important;
        }
        .neon-border-cyan {
          box-shadow: 0 0 15px rgba(102, 252, 241, 0.2);
        }
        .neon-border-magenta {
          box-shadow: 0 0 15px rgba(255, 0, 127, 0.2);
        }
        .neon-text-cyan {
          text-shadow: 0 0 8px rgba(102, 252, 241, 0.5);
        }
      `}} />

      {/* Background Shell and Grid */}
      <div className="absolute inset-0 cyber-bg -z-20"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,35,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(18,16,35,0.45)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none -z-10"></div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-[#07070c]/40 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-600 via-[#ff007f] to-[#66fcf1] flex items-center justify-center p-[2px] shadow-lg">
              <div className="w-full h-full bg-[#07070c] rounded-[6px] flex items-center justify-center">
                <Cpu className="h-4.5 w-4.5 text-[#66fcf1] animate-pulse" />
              </div>
            </div>
            <span className="font-cyber font-black tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-white via-[#66fcf1] to-[#ff007f] text-lg">NEURAL_LOG</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-cyber text-xs tracking-wider text-slate-400">
            <Link href="#" className="text-[#66fcf1] neon-text-cyan transition-colors">{"// HOME"}</Link>
            <Link href="#" className="hover:text-white transition-colors">{"// CORE_LOGS"}</Link>
            <Link href="#" className="hover:text-white transition-colors">{"// ARCHIVES"}</Link>
            <Link href="#" className="hover:text-white transition-colors">{"// NEURAL_AI"}</Link>
          </nav>

          <div className="flex items-center gap-4">
            <button className="font-cyber text-[10px] tracking-widest text-[#66fcf1] border border-[#66fcf1]/30 px-3 py-1.5 rounded bg-[#66fcf1]/5 hover:bg-[#66fcf1]/20 hover:border-[#66fcf1] transition-all duration-300">
              SECURE_CONNECT
            </button>
          </div>
        </div>
      </header>

      {/* Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Broadcast Strip */}
        <div className="mb-10 p-3 rounded-lg border border-[#ff007f]/20 bg-[#ff007f]/5 backdrop-blur-md flex items-center justify-between gap-4 overflow-hidden neon-border-magenta">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-cyber text-xs px-2 py-0.5 rounded bg-[#ff007f] text-white uppercase tracking-widest animate-pulse shrink-0">BROADCAST</span>
            <span className="text-sm font-cyber truncate text-[#ff007f]/90 tracking-wide">{"// AGENT_ANTIGRAVITY: DECODE COMPLETED. SYSTEM OPTIMIZATION STATUS: 100% ONLINE."}</span>
          </div>
          <span className="text-xs font-cyber text-[#ff007f]/60 shrink-0 font-mono">00:56:22 // SECURE</span>
        </div>

        {/* Featured Post */}
        <section className="mb-12">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-lg p-6 sm:p-8 neon-border-cyan">
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#66fcf1]/5 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-violet-600/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="font-cyber text-[10px] uppercase tracking-widest text-[#66fcf1] border border-[#66fcf1]/30 px-2 py-0.5 rounded bg-[#66fcf1]/10">NEURAL_NET</span>
                  <span className="text-xs text-slate-400 font-mono">05.22.2026 // 8 MIN_READ</span>
                </div>

                <h2 className="font-cyber font-black text-2xl sm:text-4xl text-white tracking-wide leading-tight">
                  解构意识芯片：从硅基生命到量子互联的进化日志
                </h2>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light">
                  在超量子计算纪元，我们正站在碳基与硅基最终融合的门槛上。本文探讨了最新一代生物神经网络处理器 Neural-Q 4.0 的突触映射机制，以及它是如何通过量子纠缠协议实现跨维度数据传输的……
                </p>

                <div className="pt-4 flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full border border-[#66fcf1]/30 bg-black p-0.5">
                      <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#ff007f] to-[#66fcf1] flex items-center justify-center font-cyber text-sm font-bold text-white">N</div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white font-cyber">NEURAL_DECODING_BOT</h4>
                      <p className="text-[10px] text-slate-400">SYS_ADMIN</p>
                    </div>
                  </div>

                  <button className="font-cyber text-xs tracking-widest text-[#66fcf1] group flex items-center gap-2 hover:text-white transition-colors ml-auto lg:ml-0">
                    DECRYPT_LOG <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/30 to-[#66fcf1]/30 rounded-xl blur-lg opacity-40 group-hover:opacity-85 transition-opacity duration-500"></div>
                <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(102,252,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(102,252,241,0.05)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                    <BrainCircuit className="h-20 w-20 text-[#66fcf1] animate-pulse" />
                    <div className="font-cyber text-[10px] tracking-widest text-[#66fcf1] font-mono border-t border-[#66fcf1]/20 pt-2 w-3/4">
                      MUTATION_SEQUENCE_DETECTED
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Main Feed */}
          <section className="lg:col-span-8 space-y-8">
            <h3 className="font-cyber font-black tracking-widest text-sm text-[#66fcf1] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#66fcf1] animate-ping"></span>
              {"// REALTIME_INTELLIGENCE_STREAM"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              <article className="group relative overflow-hidden rounded-xl border border-white/5 bg-slate-900/30 backdrop-blur-md p-5 hover:border-violet-500/40 hover:bg-slate-900/50 transition-all duration-300 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-cyber text-[9px] uppercase tracking-wider text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded bg-violet-600/10">ALGORITHM</span>
                    <span className="text-[10px] text-slate-500 font-mono">05.21.2026</span>
                  </div>
                  <h4 className="font-cyber font-bold text-lg text-white group-hover:text-[#66fcf1] transition-colors line-clamp-2">
                    图谱深度优先：LLM 在非结构化知识突围中的路径搜索
                  </h4>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                    利用复杂图谱算法引导生成式模型在多维空间中进行精准知识节点检索，避免生成幻觉的高精度调试日志。
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">5 MIN READ // PV: 2,451</span>
                  <Cpu className="h-4 w-4 text-violet-400 group-hover:text-[#66fcf1] transition-colors" />
                </div>
              </article>

              <article className="group relative overflow-hidden rounded-xl border border-white/5 bg-slate-900/30 backdrop-blur-md p-5 hover:border-[#66fcf1]/40 hover:bg-slate-900/50 transition-all duration-300 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-cyber text-[9px] uppercase tracking-wider text-[#66fcf1] border border-[#66fcf1]/30 px-2 py-0.5 rounded bg-[#66fcf1]/10">HARDWARE</span>
                    <span className="text-[10px] text-slate-500 font-mono">05.20.2026</span>
                  </div>
                  <h4 className="font-cyber font-bold text-lg text-white group-hover:text-[#66fcf1] transition-colors line-clamp-2">
                    超越碳纳米管：2nm 全栅极硅半导体测试分析报告
                  </h4>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                    最新的物理层评测，聚焦于新一代超窄栅极漏电控制与亚阈值摆幅的优化指标，为边缘芯片计算设计提供直接参考。
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">12 MIN READ // PV: 8,920</span>
                  <Cpu className="h-4 w-4 text-[#66fcf1] group-hover:text-white transition-colors" />
                </div>
              </article>

            </div>
          </section>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            <div className="p-6 rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-md space-y-4">
              <h4 className="font-cyber font-bold text-xs tracking-wider text-[#66fcf1] flex items-center gap-2">
                <Server className="h-4 w-4" />
                {"// NODE_NETWORK_STATUS"}
              </h4>
              <div className="space-y-3 font-mono text-xs text-slate-400">
                <div className="flex justify-between items-center">
                  <span>CORE_TEMP:</span>
                  <span className="text-emerald-500 font-semibold">32.4°C // SAFE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>SYNC_LATENCY:</span>
                  <span className="text-emerald-500 font-semibold">0.45 ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>AI_AGENT_MUTATION:</span>
                  <span className="text-[#ff007f] font-semibold animate-pulse">ACTIVE (R4)</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-md space-y-4">
              <h4 className="font-cyber font-bold text-xs tracking-wider text-[#66fcf1] flex items-center gap-2">
                <Hash className="h-4 w-4" />
                {"// CHANNELS_ROUTE"}
              </h4>
              <div className="flex flex-wrap gap-2">
                <Link href="#" className="text-xs font-cyber tracking-wider px-3 py-1.5 rounded-lg border border-white/5 bg-slate-950/40 text-slate-300 hover:border-[#66fcf1] hover:text-[#66fcf1] transition-colors">
                  #量子物理 (24)
                </Link>
                <Link href="#" className="text-xs font-cyber tracking-wider px-3 py-1.5 rounded-lg border border-white/5 bg-slate-950/40 text-slate-300 hover:border-violet-500 hover:text-violet-400 transition-colors">
                  #神经网络 (48)
                </Link>
              </div>
            </div>
          </aside>

        </div>

      </main>

    </div>
  );
}
