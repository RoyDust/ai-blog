import { AiModelManager } from "@/components/admin/ai/AiModelManager";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { getPublicAiModelOptions } from "@/lib/ai-models";

export const dynamic = "force-dynamic";

export default async function AdminAiModelsPage() {
  const models = await getPublicAiModelOptions();
  const defaultSummaryModel = models.find((model) => model.defaultFor.includes("post-summary")) ?? models.find((model) => model.capabilities.includes("post-summary"));
  const defaultCoverModel = models.find((model) => model.defaultFor.includes("cover-image")) ?? models.find((model) => model.capabilities.includes("cover-image"));
  const readyCount = models.filter((model) => model.status === "ready").length;
  const coverModelCount = models.filter((model) => model.capabilities.includes("cover-image")).length;
  const customCount = models.filter((model) => model.source === "database").length;

  const metrics = [
    { label: "摘要默认", value: defaultSummaryModel?.model ?? "未配置", mono: Boolean(defaultSummaryModel) },
    { label: "可用模型", value: String(readyCount), mono: true },
    { label: "生图默认", value: defaultCoverModel?.model ?? `${coverModelCount} 个可选`, mono: Boolean(defaultCoverModel) },
    { label: "自定义模型", value: String(customCount), mono: true },
  ];

  return (
    <div className="flex flex-col gap-7 pb-2">
      <PageHeader
        eyebrow="AI 助手"
        title="AI 配置选择"
        description="管理后台写作和封面生成使用的 AI 模型。每种能力独立选择默认模型，摘要切换不会影响封面生图。"
      />

      <section className="grid gap-x-10 gap-y-5 xl:grid-cols-[minmax(0,1fr)_340px]" aria-label="模型概览">
        <dl className="grid grid-cols-2 border-y border-[var(--border)] sm:grid-cols-4">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`min-w-0 px-4 py-3.5 ${index > 0 ? "sm:border-l sm:border-[var(--border)]" : ""} ${index % 2 === 1 ? "border-l border-[var(--border)]" : ""}`}
            >
              <dt className="text-xs text-[var(--text-muted)]">{metric.label}</dt>
              <dd className={`mt-1 truncate text-lg font-bold text-[var(--foreground)] ${metric.mono ? "font-mono tabular-nums" : ""}`} title={metric.value}>
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <aside className="border-l-2 border-[var(--reader-border-strong)] pl-4">
          <h2 className="font-serif text-base font-bold text-[var(--foreground)]">当前接入范围</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.8125rem] leading-6 text-[var(--text-body)] marker:text-[var(--text-muted)]">
            <li>文章摘要、元信息补全、审稿和 AI 封面生成使用这里的模型配置。</li>
            <li>连接测试会真实请求模型测试接口。</li>
            <li>封面生图会保存到七牛和封面图库；成本统计暂未接入。</li>
          </ul>
        </aside>
      </section>

      <AiModelManager initialModels={models} />
    </div>
  );
}
