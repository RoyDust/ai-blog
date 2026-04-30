import { CheckCircle2, SlidersHorizontal } from "lucide-react";

import { AiModelManager } from "@/components/admin/ai/AiModelManager";
import { getPublicAiModelOptions } from "@/lib/ai-models";

export const dynamic = "force-dynamic";

export default async function AdminAiModelsPage() {
  const models = await getPublicAiModelOptions();
  const defaultSummaryModel = models.find((model) => model.defaultFor.includes("post-summary")) ?? models[0];
  const readyCount = models.filter((model) => model.status === "ready").length;
  const customCount = models.filter((model) => model.source === "database").length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="ui-surface rounded-xl p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[var(--brand)]">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">AI Config</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[var(--foreground)]">AI 配置选择</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                选择后台写作功能使用的摘要模型。内置模型来自环境变量，自定义模型保存在数据库；新增、测试和默认切换继续使用现有接口。
              </p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
              <dt className="text-xs text-[var(--muted)]">当前默认</dt>
              <dd className="mt-2 truncate text-sm font-semibold text-[var(--foreground)]">{defaultSummaryModel?.model ?? "未配置"}</dd>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
              <dt className="text-xs text-[var(--muted)]">可用模型</dt>
              <dd className="mt-2 text-sm font-semibold text-[var(--foreground)]">{readyCount}</dd>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
              <dt className="text-xs text-[var(--muted)]">自定义模型</dt>
              <dd className="mt-2 text-sm font-semibold text-[var(--foreground)]">{customCount}</dd>
            </div>
          </dl>
        </div>

        <aside className="ui-surface rounded-xl p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">当前接入范围</h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
              <span>文章摘要、元信息补全和审稿入口使用这里的模型配置。</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
              <span>连接测试会真实请求模型测试接口。</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
              <span>多能力路由和成本统计暂未接后端，先不做成可操作控件。</span>
            </li>
          </ul>
        </aside>
      </section>

      <AiModelManager initialModels={models} />
    </div>
  );
}
