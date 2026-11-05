import Link from "next/link";

import { MetricStrip } from "@/components/admin/lists";
import { adminHairlineRowClassName } from "@/components/admin/primitives/admin-classes";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { StatusBadge, type StatusTone } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/admin/ui";
import { TextAnchor } from "@/components/editorial";
import {
  aiInterfaceAudienceLabels,
  aiInterfaceCatalog,
  buildAiAgentUsagePrompt,
  type AiInterfaceAudience,
  type AiInterfaceCatalogItem,
} from "@/lib/ai-interface-catalog";
import { getBlogSettings } from "@/lib/blog-settings";
import { AiTokenGenerator } from "./AiTokenGenerator";

export const dynamic = "force-dynamic";

const audienceOrder: AiInterfaceAudience[] = ["agent", "admin", "cron"];

const audienceMeta: Record<
  AiInterfaceAudience,
  {
    title: string;
    description: string;
    tone: StatusTone;
  }
> = {
  agent: {
    title: "Agent 可调用接口",
    description: "面向外部 AI agent 的稳定写作接口，可用 AI Token 鉴权。",
    tone: "success",
  },
  admin: {
    title: "后台内部 AI 接口",
    description: "后台界面使用的模型、任务、摘要、审稿、封面和 AI 日报能力。",
    tone: "info",
  },
  cron: {
    title: "定时任务接口",
    description: "由服务端计划任务调用，不提供给普通 agent 直接使用。",
    tone: "warning",
  },
};

function getAbsoluteUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return path.startsWith("http") ? path : `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function InterfaceCard({ baseUrl, item }: { baseUrl: string; item: AiInterfaceCatalogItem }) {
  const meta = audienceMeta[item.audience];
  const canOpenDirectly = item.methods.includes("GET") && item.auth === "公开";

  return (
    <article className={`${adminHairlineRowClassName} py-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="font-serif text-[0.9375rem] font-bold text-[var(--foreground)]">{item.name}</h3>
          <StatusBadge tone={meta.tone}>{aiInterfaceAudienceLabels[item.audience]}</StatusBadge>
          <span className="font-mono text-xs font-bold text-[var(--foreground)]">{item.methods.join(" ")}</span>
          <code className="font-mono text-[0.8125rem] break-all text-[var(--text-body)]">{item.path}</code>
        </div>
        {canOpenDirectly ? (
          <TextAnchor arrow="external" className="text-[0.8125rem]" href={getAbsoluteUrl(baseUrl, item.path)} rel="noreferrer" target="_blank">
            打开
          </TextAnchor>
        ) : null}
      </div>

      <p className="mt-1.5 text-[0.875rem] leading-6 text-[var(--text-body)]">{item.feature}</p>

      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-[0.8125rem] lg:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs font-bold text-[var(--text-muted)]">鉴权</dt>
          <dd className="mt-0.5 leading-5 text-[var(--foreground)]">{item.auth}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-bold text-[var(--text-muted)]">请求</dt>
          <dd className="mt-0.5 leading-5 text-[var(--foreground)]">{item.requestHint}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-bold text-[var(--text-muted)]">返回</dt>
          <dd className="mt-0.5 leading-5 text-[var(--foreground)]">{item.responseHint}</dd>
        </div>
      </dl>
    </article>
  );
}

export default async function AdminAiInterfacesPage() {
  const settings = await getBlogSettings();
  const baseUrl = settings.siteUrl.replace(/\/+$/, "");
  const prompt = buildAiAgentUsagePrompt({
    baseUrl,
    siteName: settings.siteName,
  });
  const agentInterfaces = aiInterfaceCatalog.filter((item) => item.audience === "agent");
  const adminInterfaces = aiInterfaceCatalog.filter((item) => item.audience === "admin");
  const cronInterfaces = aiInterfaceCatalog.filter((item) => item.audience === "cron");

  return (
    <div>
      <PageHeader
        eyebrow="AI 助手"
        title="AI 接口目录"
        description="集中查看 AI agent、后台 AI 工作流和定时任务接口，并提供可直接交给 agent 的调用提示词。"
        action={
          <Button asChild variant="outline">
            <Link href="/admin/ai/models">模型配置</Link>
          </Button>
        }
      />

      <MetricStrip
        ariaLabel="接口概况"
        className="mt-1"
        items={[
          { key: "agent", label: "Agent 接口", value: agentInterfaces.length, note: "AI Token 鉴权，可交给外部 agent" },
          { key: "admin", label: "后台内部接口", value: adminInterfaces.length, note: "后台会话鉴权" },
          { key: "cron", label: "定时入口", value: cronInterfaces.length, note: "内部密钥网关" },
        ]}
      />

      <section aria-labelledby="admin-ai-prompt-title" className="mt-6">
        <AdminSectionHeader description="Agent Prompt" id="admin-ai-prompt-title" title="给 AI agent 的使用提示词" />
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 pt-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="text-[0.875rem] leading-6 text-[var(--text-body)]">
              登录后可直接在此生成包含 taxonomy:read、drafts:read、drafts:write 的 AI Token，再把提示词和 token 提供给 agent。
            </p>
            <AiTokenGenerator />
            <p className="mt-5 text-xs leading-5 text-[var(--text-muted)]">也可以在服务器上用脚本创建 token：</p>
            <code className="mt-2 block rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] px-3 py-2.5 font-mono text-xs leading-5 break-all text-[var(--foreground)]">
              node --env-file=.env scripts/create-ai-api-token.mjs --name codex --email admin@example.com --scopes drafts:read,drafts:write,taxonomy:read
            </code>
          </div>
          <pre className="max-h-[560px] overflow-auto rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-4 font-mono text-[0.8125rem] leading-6 whitespace-pre-wrap text-[var(--foreground)]">
            {prompt}
          </pre>
        </div>
      </section>

      {audienceOrder.map((audience) => {
        const items = aiInterfaceCatalog.filter((item) => item.audience === audience);
        const meta = audienceMeta[audience];

        return (
          <section key={audience} aria-labelledby={`admin-ai-interfaces-${audience}`} className="mt-8">
            <AdminSectionHeader
              aside={<span className="ed-mono">{items.length} 个接口</span>}
              description={meta.description}
              id={`admin-ai-interfaces-${audience}`}
              title={meta.title}
            />
            <div className="mt-1">
              {items.map((item) => (
                <InterfaceCard key={`${item.methods.join("-")}-${item.path}`} baseUrl={baseUrl} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
