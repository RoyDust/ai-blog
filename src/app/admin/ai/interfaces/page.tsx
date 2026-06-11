import Link from "next/link";
import {
  Bot,
  Braces,
  ExternalLink,
  KeyRound,
  Route,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Badge, Button } from "@/components/admin/ui";
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
    badgeClassName: string;
  }
> = {
  agent: {
    title: "Agent 可调用接口",
    description: "面向外部 AI agent 的稳定写作接口，可用 AI Token 鉴权。",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  admin: {
    title: "后台内部 AI 接口",
    description: "后台界面使用的模型、任务、摘要、审稿、封面和 AI 日报能力。",
    badgeClassName: "border-[color-mix(in_oklab,var(--brand)_22%,var(--border))] bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] text-[var(--brand)]",
  },
  cron: {
    title: "定时任务接口",
    description: "由服务端计划任务调用，不提供给普通 agent 直接使用。",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
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
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_18px_34px_-32px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-[var(--foreground)]">{item.name}</h3>
            <Badge className={meta.badgeClassName}>{aiInterfaceAudienceLabels[item.audience]}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {item.methods.map((method) => (
              <span
                key={method}
                className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[11px] font-semibold text-[var(--foreground)]"
              >
                {method}
              </span>
            ))}
            <code className="break-all rounded-md bg-[var(--surface-alt)] px-2 py-1 text-xs text-[var(--foreground)]">
              {item.path}
            </code>
          </div>
        </div>
        {canOpenDirectly ? (
          <Link
            href={getAbsoluteUrl(baseUrl, item.path)}
            target="_blank"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
          >
            打开
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{item.feature}</p>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm lg:grid-cols-3">
        <div className="rounded-xl bg-[var(--surface-alt)] p-3">
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <KeyRound className="h-3.5 w-3.5" />
            鉴权
          </dt>
          <dd className="mt-2 leading-5 text-[var(--foreground)]">{item.auth}</dd>
        </div>
        <div className="rounded-xl bg-[var(--surface-alt)] p-3">
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <TerminalSquare className="h-3.5 w-3.5" />
            请求
          </dt>
          <dd className="mt-2 leading-5 text-[var(--foreground)]">{item.requestHint}</dd>
        </div>
        <div className="rounded-xl bg-[var(--surface-alt)] p-3">
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <Braces className="h-3.5 w-3.5" />
            返回
          </dt>
          <dd className="mt-2 leading-5 text-[var(--foreground)]">{item.responseHint}</dd>
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Interfaces"
        title="AI 接口目录"
        description="集中查看 AI agent、后台 AI 工作流和定时任务接口，并提供可直接交给 agent 的调用提示词。"
        action={
          <Link href="/admin/ai/models">
            <Button size="sm" variant="outline" type="button">模型配置</Button>
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="ui-surface rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-[var(--muted)]">Agent 接口</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{agentInterfaces.length}</p>
            </div>
          </div>
        </div>
        <div className="ui-surface rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] text-[var(--brand)]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-[var(--muted)]">后台内部接口</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{adminInterfaces.length}</p>
            </div>
          </div>
        </div>
        <div className="ui-surface rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Route className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-[var(--muted)]">定时入口</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{cronInterfaces.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ui-surface overflow-hidden rounded-3xl">
        <div className="grid grid-cols-1 gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface-alt)] p-6 xl:border-b-0 xl:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Agent Prompt</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-[var(--foreground)]">给 AI agent 的使用提示词</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              登录后可直接在此生成包含 taxonomy:read、drafts:read、drafts:write 的 AI Token，再把提示词和 token 提供给 agent。
            </p>
            <AiTokenGenerator />
            <p className="mt-5 text-xs leading-5 text-[var(--muted)]">也可以在服务器上用脚本创建 token：</p>
            <code className="mt-5 block break-all rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--foreground)]">
              node --env-file=.env scripts/create-ai-api-token.mjs --name codex --email admin@example.com --scopes drafts:read,drafts:write,taxonomy:read
            </code>
          </div>
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap p-6 text-sm leading-6 text-[var(--foreground)]">
            {prompt}
          </pre>
        </div>
      </section>

      {audienceOrder.map((audience) => {
        const items = aiInterfaceCatalog.filter((item) => item.audience === audience);
        const meta = audienceMeta[audience];

        return (
          <section key={audience} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">{meta.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{meta.description}</p>
              </div>
              <Badge className={meta.badgeClassName}>{items.length} 个接口</Badge>
            </div>
            <div className="grid grid-cols-1 gap-4">
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
