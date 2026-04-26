"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Network, Pencil, Plus, RadioTower, TestTube2, Trash2 } from "lucide-react";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { PublicAiModelOption } from "@/lib/ai-models";

type FormState = {
  id?: string;
  name: string;
  description: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  isDefaultForSummary: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "",
  apiKey: "",
  enabled: true,
  isDefaultForSummary: false,
};

const capabilityLabels: Record<string, string> = {
  "post-summary": "文章摘要",
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
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    baseUrl: model.baseUrl,
    model: model.model,
    apiKey: "",
    enabled: model.enabled,
    isDefaultForSummary: model.defaultFor.includes("post-summary"),
  };
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "请求失败");
  }

  return data;
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
    () => models.find((model) => model.defaultFor.includes("post-summary")) ?? models[0],
    [models],
  );
  const customModelCount = models.filter((model) => model.source === "database").length;

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
        requestPath: "/chat/completions",
        model: form.model,
        apiKey: form.apiKey || undefined,
        capabilities: ["post-summary"],
        isDefaultForSummary: form.isDefaultForSummary,
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

  const handleSetDefault = async (model: PublicAiModelOption) => {
    if (model.defaultFor.includes("post-summary") || switchingId) return;

    setSwitchingId(model.id);
    setError("");
    setMessage("");

    try {
      await readJson(await fetch("/api/admin/ai/models/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model.id, capability: "post-summary" }),
      }));
      await refreshModels();
      setMessage(`已切换为「${model.name}」。`);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "切换模型失败");
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="ui-surface rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Selectable</p>
          <p className="mt-3 font-display text-3xl font-semibold text-[var(--foreground)]">{models.length}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">当前可选模型</p>
        </div>
        <div className="ui-surface rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Custom</p>
          <p className="mt-3 font-display text-3xl font-semibold text-[var(--foreground)]">{customModelCount}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">可编辑模型</p>
        </div>
        <div className="ui-surface rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Default Summary</p>
          <p className="mt-3 truncate font-display text-2xl font-semibold text-[var(--foreground)]">
            {defaultSummaryModel?.model ?? "未配置"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">摘要默认模型</p>
        </div>
      </section>

      {(message || error) ? (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error ? "ui-alert-danger" : "ui-status-success"
          }`}
        >
          {error || message}
        </div>
      ) : null}

      <WorkspacePanel
        title="模型列表"
        description="内置摘要模型来自环境变量；自定义模型会保存在数据库，可编辑、删除、测试并设为摘要默认。"
        actions={
          <Button size="sm" type="button" onClick={() => setForm(emptyForm)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            新增模型
          </Button>
        }
        className="border border-[var(--border)]"
      >
        <div className="space-y-4">
          {models.map((model) => (
            <article
              key={model.id}
              className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                        <input
                          aria-label={`选择 ${model.name}`}
                          checked={model.defaultFor.includes("post-summary")}
                          className="ui-checkbox h-4 w-4"
                          disabled={Boolean(switchingId) || model.status !== "ready"}
                          name="ai-model"
                          onChange={() => void handleSetDefault(model)}
                          type="radio"
                          value={model.id}
                        />
                        {model.name}
                      </label>
                      {defaultSummaryModel?.id === model.id ? <StatusBadge tone="success">当前首选</StatusBadge> : null}
                      {model.defaultFor.includes("post-summary") ? <StatusBadge tone="success">摘要默认</StatusBadge> : null}
                      <StatusBadge tone={statusTone(model.status)}>{statusLabel(model.status)}</StatusBadge>
                      {model.source === "environment" ? <StatusBadge>环境变量</StatusBadge> : <StatusBadge>数据库</StatusBadge>}
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                      {model.description || "未填写描述。"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                    <Button
                      disabled={model.defaultFor.includes("post-summary") || model.status !== "ready" || Boolean(switchingId)}
                      onClick={() => void handleSetDefault(model)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {switchingId === model.id ? "切换中" : "设为默认"}
                    </Button>
                    <Button
                      disabled={testingId === model.id}
                      onClick={() => void handleTest(model)}
                      size="sm"
                      type="button"
                      variant="outline"
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
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      删除
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <Network className="h-4 w-4" aria-hidden="true" />
                      Endpoint
                    </div>
                    <p className="mt-2 break-all text-sm font-medium text-[var(--foreground)]">
                      {model.baseUrl}
                      {model.requestPath}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <RadioTower className="h-4 w-4" aria-hidden="true" />
                      Model
                    </div>
                    <p className="mt-2 break-all text-sm font-medium text-[var(--foreground)]">{model.model}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      Secret
                    </div>
                    <p className="mt-2 break-all text-sm font-medium text-[var(--foreground)]">
                      {model.hasApiKey ? "已配置" : model.apiKeyEnv}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      能力
                    </div>
                    <div className="mt-3 space-y-2">
                      {model.capabilities.map((capability) => (
                        <div key={capability} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                          <CheckCircle2 className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />
                          {capabilityLabels[capability] ?? capability}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {model.lastTestMessage ? (
                  <p className="text-sm text-[var(--muted)]">
                    最近测试：{model.lastTestStatus === "success" ? "通过" : "失败"} · {model.lastTestMessage}
                  </p>
                ) : null}
              </div>
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
                placeholder="qwen3.5-flash"
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

            <div className="flex flex-wrap gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
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
                  checked={form.isDefaultForSummary}
                  className="ui-checkbox h-4 w-4"
                  type="checkbox"
                  onChange={(event) =>
                    setForm((prev) => prev ? { ...prev, isDefaultForSummary: event.target.checked } : prev)
                  }
                />
                设为文章摘要默认模型
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                取消
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? "保存中..." : "保存模型"}
              </Button>
            </div>
          </form>
        </WorkspacePanel>
      ) : null}
    </div>
  );
}
