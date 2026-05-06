"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ImageIcon, KeyRound, Network, Pencil, Plus, RadioTower, Sparkles, TestTube2, Trash2 } from "lucide-react";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/admin/ui";
import { Input } from "@/components/admin/ui";
import type { PublicAiModelOption } from "@/lib/ai-models";

type Capability = "post-summary" | "cover-image";

type FormState = {
  id?: string;
  name: string;
  description: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  capabilities: Capability[];
  isDefaultForSummary: boolean;
  isDefaultForCoverImage: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "",
  apiKey: "",
  enabled: true,
  capabilities: ["post-summary"],
  isDefaultForSummary: false,
  isDefaultForCoverImage: false,
};

const capabilityLabels: Record<Capability, string> = {
  "post-summary": "文章摘要",
  "cover-image": "封面生图",
};

const capabilityDescriptions: Record<Capability, string> = {
  "post-summary": "编辑器摘要、SEO 辅助与批量摘要任务使用。",
  "cover-image": "文章封面 AI 生图流程使用，生成后会落库并上传七牛。",
};

function statusTone(status: string) {
  return status === "ready" ? "success" : status === "disabled" ? "neutral" : "warning";
}

function statusLabel(status: string) {
  if (status === "ready") return "可用";
  if (status === "disabled") return "已停用";
  return "待配置密钥";
}

function formFromModel(model: PublicAiModelOption): FormState {
  const capabilities = model.capabilities.filter(
    (capability): capability is Capability => capability === "post-summary" || capability === "cover-image",
  );

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    baseUrl: model.baseUrl,
    model: model.model,
    apiKey: "",
    enabled: model.enabled,
    capabilities,
    isDefaultForSummary: model.defaultFor.includes("post-summary"),
    isDefaultForCoverImage: model.defaultFor.includes("cover-image"),
  };
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "请求失败");
  }

  return data;
}

function CapabilityDefaultCard({
  capability,
  icon,
  models,
  defaultModel,
  switchingId,
  onSwitch,
}: {
  capability: Capability;
  icon: React.ReactNode;
  models: PublicAiModelOption[];
  defaultModel?: PublicAiModelOption;
  switchingId: string | null;
  onSwitch: (model: PublicAiModelOption, capability: Capability) => void;
}) {
  const availableModels = models.filter((model) => model.capabilities.includes(capability));

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-2 text-[var(--brand)]">{icon}</div>
          <div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">{capabilityLabels[capability]}</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{capabilityDescriptions[capability]}</p>
          </div>
        </div>
        <StatusBadge tone={defaultModel?.status === "ready" ? "success" : "warning"}>
          {defaultModel ? "已选择" : "待选择"}
        </StatusBadge>
      </div>

      <div className="mt-4 space-y-2">
        {availableModels.map((model) => {
          const checked = model.defaultFor.includes(capability);
          const disabled = Boolean(switchingId) || model.status !== "ready";

          return (
            <label
              key={`${capability}-${model.id}`}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                checked
                  ? "border-[var(--brand)] bg-[var(--surface-alt)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
              } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <input
                aria-label={`选择 ${capabilityLabels[capability]} ${model.name}`}
                checked={checked}
                className="ui-checkbox mt-1 h-4 w-4"
                disabled={disabled}
                name={`ai-model-${capability}`}
                onChange={() => onSwitch(model, capability)}
                type="radio"
                value={model.id}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  {model.name}
                  {checked ? <StatusBadge tone="success">当前默认</StatusBadge> : null}
                  <StatusBadge tone={statusTone(model.status)}>{statusLabel(model.status)}</StatusBadge>
                </span>
                <span className="mt-1 block truncate text-xs text-[var(--muted)]">{model.model}</span>
              </span>
            </label>
          );
        })}
        {availableModels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
            暂无支持{capabilityLabels[capability]}的模型。
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AiModelManager({ initialModels }: { initialModels: PublicAiModelOption[] }) {
  const [models, setModels] = useState(initialModels);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const defaultSummaryModel = useMemo(
    () => models.find((model) => model.defaultFor.includes("post-summary")) ?? models.find((model) => model.capabilities.includes("post-summary")),
    [models],
  );
  const defaultCoverModel = useMemo(
    () => models.find((model) => model.defaultFor.includes("cover-image")) ?? models.find((model) => model.capabilities.includes("cover-image")),
    [models],
  );

  const refreshModels = async () => {
    const data = await readJson(await fetch("/api/admin/ai/models"));
    setModels(Array.isArray(data.data) ? data.data : []);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        name: form.name,
        description: form.description,
        baseUrl: form.baseUrl,
        requestPath: form.capabilities.includes("cover-image") && !form.capabilities.includes("post-summary")
          ? "/services/aigc/image-generation/generation"
          : "/chat/completions",
        model: form.model,
        apiKey: form.apiKey || undefined,
        capabilities: form.capabilities,
        isDefaultForSummary: form.capabilities.includes("post-summary") && form.isDefaultForSummary,
        isDefaultForCoverImage: form.capabilities.includes("cover-image") && form.isDefaultForCoverImage,
        enabled: form.enabled,
      };
      const response = form.id
        ? await fetch(`/api/admin/ai/models/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/ai/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      await readJson(response);
      await refreshModels();
      setForm(null);
      setMessage(form.id ? "模型已更新。" : "模型已创建。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (model: PublicAiModelOption) => {
    if (!model.deletable) return;
    if (!window.confirm(`删除模型「${model.name}」？`)) return;

    setDeletingId(model.id);
    setError("");
    setMessage("");

    try {
      await readJson(await fetch(`/api/admin/ai/models/${model.id}`, { method: "DELETE" }));
      await refreshModels();
      setMessage("模型已删除。");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (model: PublicAiModelOption) => {
    setTestingId(model.id);
    setError("");
    setMessage("");

    try {
      const data = await readJson(await fetch(`/api/admin/ai/models/${model.id}/test`, { method: "POST" }));
      await refreshModels();
      setMessage(data.data?.message || "模型测试通过。");
    } catch (testError) {
      await refreshModels().catch(() => undefined);
      setError(testError instanceof Error ? testError.message : "模型测试失败");
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (model: PublicAiModelOption, capability: Capability) => {
    if (model.defaultFor.includes(capability) || switchingId) return;

    setSwitchingId(`${capability}:${model.id}`);
    setError("");
    setMessage("");

    try {
      await readJson(await fetch("/api/admin/ai/models/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model.id, capability }),
      }));
      await refreshModels();
      setMessage(`已将${capabilityLabels[capability]}切换为「${model.name}」。`);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "切换模型失败");
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {message || error ? (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm ${error ? "ui-alert-danger" : "ui-status-success"}`}
        >
          {error || message}
        </div>
      ) : null}

      <WorkspacePanel
        title="按能力选择默认模型"
        description={`文章摘要：${defaultSummaryModel?.name ?? "未配置"}；封面生图：${defaultCoverModel?.name ?? "未配置"}。每种能力独立单选，互不影响。`}
        actions={
          <Button size="sm" type="button" onClick={() => setForm(emptyForm)} className="rounded-lg">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            新增模型
          </Button>
        }
        className="border border-[var(--border)]"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <CapabilityDefaultCard
            capability="post-summary"
            icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
            models={models}
            defaultModel={defaultSummaryModel}
            switchingId={switchingId}
            onSwitch={handleSetDefault}
          />
          <CapabilityDefaultCard
            capability="cover-image"
            icon={<ImageIcon className="h-5 w-5" aria-hidden="true" />}
            models={models}
            defaultModel={defaultCoverModel}
            switchingId={switchingId}
            onSwitch={handleSetDefault}
          />
        </div>
      </WorkspacePanel>

      <WorkspacePanel
        title="模型库"
        description="统一维护环境变量内置模型与数据库自定义模型。模型可同时支持多种能力，但默认选择按能力独立设置。"
        className="border border-[var(--border)]"
      >
        <div className="grid gap-3">
          {models.map((model) => (
            <article
              key={model.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)]"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--foreground)]">{model.name}</h3>
                    {model.defaultFor.map((capability) => (
                      <StatusBadge key={capability} tone="success">
                        {capabilityLabels[capability]}默认
                      </StatusBadge>
                    ))}
                    <StatusBadge tone={statusTone(model.status)}>{statusLabel(model.status)}</StatusBadge>
                    {model.source === "environment" ? <StatusBadge>环境变量</StatusBadge> : <StatusBadge>数据库</StatusBadge>}
                  </div>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted)]">{model.description || "未填写描述。"}</p>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <Button
                    disabled={testingId === model.id}
                    onClick={() => void handleTest(model)}
                    size="sm"
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                  >
                    <TestTube2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    {testingId === model.id ? "测试中" : "测试"}
                  </Button>
                  <Button
                    disabled={!model.editable}
                    onClick={() => setForm(formFromModel(model))}
                    size="sm"
                    type="button"
                    variant="secondary"
                    className="rounded-lg"
                  >
                    <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                    修改
                  </Button>
                  <Button
                    disabled={!model.deletable || deletingId === model.id}
                    onClick={() => void handleDelete(model)}
                    size="sm"
                    type="button"
                    variant="danger"
                    className="rounded-lg"
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    删除
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <Network className="h-4 w-4" aria-hidden="true" />
                    Endpoint
                  </div>
                  <p className="mt-2 break-all text-sm font-medium text-[var(--foreground)]">
                    {model.baseUrl}
                    {model.requestPath}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <RadioTower className="h-4 w-4" aria-hidden="true" />
                    Model
                  </div>
                  <p className="mt-2 break-all text-sm font-medium text-[var(--foreground)]">{model.model}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Secret
                  </div>
                  <p className="mt-2 break-all text-sm font-medium text-[var(--foreground)]">{model.hasApiKey ? "已配置" : model.apiKeyEnv}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    能力
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {model.capabilities.map((capability) => (
                      <StatusBadge key={capability}>{capabilityLabels[capability] ?? capability}</StatusBadge>
                    ))}
                  </div>
                </div>
              </div>
              {model.lastTestMessage ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  最近测试：{model.lastTestStatus === "success" ? "通过" : "失败"} · {model.lastTestMessage}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </WorkspacePanel>

      {form ? (
        <WorkspacePanel
          title={form.id ? "修改模型" : "新增模型"}
          description="保存后可立即测试连接；编辑已有模型时，API Key 留空会保留原值。"
          className="border border-[var(--border)]"
        >
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Input
                label="模型名称"
                value={form.name}
                onChange={(event) => setForm((prev) => prev ? { ...prev, name: event.target.value } : prev)}
                required
              />
              <Input
                label="模型 ID"
                placeholder="qwen3.5-flash / wan2.6-t2i"
                value={form.model}
                onChange={(event) => setForm((prev) => prev ? { ...prev, model: event.target.value } : prev)}
                required
              />
              <Input
                label="Base URL"
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(event) => setForm((prev) => prev ? { ...prev, baseUrl: event.target.value } : prev)}
                required
              />
              <Input
                label={form.id ? "API Key（留空保持不变）" : "API Key"}
                type="password"
                value={form.apiKey}
                onChange={(event) => setForm((prev) => prev ? { ...prev, apiKey: event.target.value } : prev)}
              />
            </div>

            <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="ai-model-description">
              描述
            </label>
            <textarea
              id="ai-model-description"
              className="ui-ring min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              value={form.description}
              onChange={(event) => setForm((prev) => prev ? { ...prev, description: event.target.value } : prev)}
            />

            <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.enabled}
                  className="ui-checkbox h-4 w-4"
                  type="checkbox"
                  onChange={(event) => setForm((prev) => prev ? { ...prev, enabled: event.target.checked } : prev)}
                />
                启用模型
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.capabilities.includes("post-summary")}
                  className="ui-checkbox h-4 w-4"
                  type="checkbox"
                  onChange={(event) =>
                    setForm((prev) => {
                      if (!prev) return prev;
                      const next = event.target.checked
                        ? Array.from(new Set([...prev.capabilities, "post-summary" as const]))
                        : prev.capabilities.filter((capability) => capability !== "post-summary");
                      return {
                        ...prev,
                        capabilities: next.length ? next : ["cover-image"],
                        isDefaultForSummary: event.target.checked ? prev.isDefaultForSummary : false,
                      };
                    })
                  }
                />
                文章摘要能力
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.capabilities.includes("cover-image")}
                  className="ui-checkbox h-4 w-4"
                  type="checkbox"
                  onChange={(event) =>
                    setForm((prev) => {
                      if (!prev) return prev;
                      const next = event.target.checked
                        ? Array.from(new Set([...prev.capabilities, "cover-image" as const]))
                        : prev.capabilities.filter((capability) => capability !== "cover-image");
                      return {
                        ...prev,
                        capabilities: next.length ? next : ["post-summary"],
                        isDefaultForCoverImage: event.target.checked ? prev.isDefaultForCoverImage : false,
                      };
                    })
                  }
                />
                封面生图能力
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.isDefaultForSummary}
                  className="ui-checkbox h-4 w-4"
                  disabled={!form.capabilities.includes("post-summary")}
                  type="checkbox"
                  onChange={(event) => setForm((prev) => prev ? { ...prev, isDefaultForSummary: event.target.checked } : prev)}
                />
                设为文章摘要默认
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.isDefaultForCoverImage}
                  className="ui-checkbox h-4 w-4"
                  disabled={!form.capabilities.includes("cover-image")}
                  type="checkbox"
                  onChange={(event) => setForm((prev) => prev ? { ...prev, isDefaultForCoverImage: event.target.checked } : prev)}
                />
                设为封面生图默认
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)} className="rounded-lg">
                取消
              </Button>
              <Button disabled={saving} type="submit" className="rounded-lg">
                {saving ? "保存中..." : "保存模型"}
              </Button>
            </div>
          </form>
        </WorkspacePanel>
      ) : null}
    </div>
  );
}
