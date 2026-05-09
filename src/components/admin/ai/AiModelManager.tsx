"use client";

import type { FormEvent, ReactNode } from "react";
import { CheckCircle2, ImageIcon, KeyRound, Network, Pencil, Plus, RadioTower, Sparkles, TestTube2, Trash2 } from "lucide-react";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/admin/ui";
import { Input } from "@/components/admin/ui";
import type { PublicAiModelOption } from "@/lib/ai-models";

import { useModelActions } from "./hooks/useModelActions";
import { useModelForm, type Capability } from "./hooks/useModelForm";

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

function CapabilityDefaultCard({
  capability,
  icon,
  models,
  defaultModel,
  switchingId,
  onSwitch,
}: {
  capability: Capability;
  icon: ReactNode;
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
  const { form, startCreate, startEdit, resetForm, updateFormField, toggleCapability } = useModelForm();
  const {
    models,
    defaultSummaryModel,
    defaultCoverModel,
    saving,
    testingId,
    switchingId,
    deletingId,
    message,
    error,
    saveModel,
    deleteModel,
    testModel,
    setDefaultModel,
  } = useModelActions(initialModels, { onSaveSuccess: resetForm });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;

    await saveModel(form);
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
          <Button size="sm" type="button" onClick={startCreate} className="rounded-lg">
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
            onSwitch={(model, capability) => void setDefaultModel(model, capability)}
          />
          <CapabilityDefaultCard
            capability="cover-image"
            icon={<ImageIcon className="h-5 w-5" aria-hidden="true" />}
            models={models}
            defaultModel={defaultCoverModel}
            switchingId={switchingId}
            onSwitch={(model, capability) => void setDefaultModel(model, capability)}
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
                    onClick={() => void testModel(model)}
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
                    onClick={() => startEdit(model)}
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
                    onClick={() => void deleteModel(model)}
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
                onChange={(event) => updateFormField("name", event.target.value)}
                required
              />
              <Input
                label="模型 ID"
                placeholder="qwen3.5-flash / wan2.6-t2i"
                value={form.model}
                onChange={(event) => updateFormField("model", event.target.value)}
                required
              />
              <Input
                label="Base URL"
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(event) => updateFormField("baseUrl", event.target.value)}
                required
              />
              <Input
                label="Request Path"
                placeholder="/chat/completions / /images/generations"
                value={form.requestPath}
                onChange={(event) => updateFormField("requestPath", event.target.value)}
                required
              />
              <Input
                label={form.id ? "API Key（留空保持不变）" : "API Key"}
                type="password"
                value={form.apiKey}
                onChange={(event) => updateFormField("apiKey", event.target.value)}
              />
            </div>

            <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="ai-model-description">
              描述
            </label>
            <textarea
              id="ai-model-description"
              className="ui-ring min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              value={form.description}
              onChange={(event) => updateFormField("description", event.target.value)}
            />

            <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.enabled}
                  className="ui-checkbox h-4 w-4"
                  type="checkbox"
                  onChange={(event) => updateFormField("enabled", event.target.checked)}
                />
                启用模型
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.capabilities.includes("post-summary")}
                  className="ui-checkbox h-4 w-4"
                  type="checkbox"
                  onChange={(event) => toggleCapability("post-summary", event.target.checked)}
                />
                文章摘要能力
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.capabilities.includes("cover-image")}
                  className="ui-checkbox h-4 w-4"
                  type="checkbox"
                  onChange={(event) => toggleCapability("cover-image", event.target.checked)}
                />
                封面生图能力
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.isDefaultForSummary}
                  className="ui-checkbox h-4 w-4"
                  disabled={!form.capabilities.includes("post-summary")}
                  type="checkbox"
                  onChange={(event) => updateFormField("isDefaultForSummary", event.target.checked)}
                />
                设为文章摘要默认
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  checked={form.isDefaultForCoverImage}
                  className="ui-checkbox h-4 w-4"
                  disabled={!form.capabilities.includes("cover-image")}
                  type="checkbox"
                  onChange={(event) => updateFormField("isDefaultForCoverImage", event.target.checked)}
                />
                设为封面生图默认
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm} className="rounded-lg">
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
