"use client";

import { useState } from "react";

import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { adminTextActionClassName, adminTextActionDangerClassName } from "@/components/admin/primitives/admin-classes";
import { Button } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { FadeBanner } from "@/components/admin/workspace/WorkspaceKit";
import { Reveal, StaggerItem, StaggerList } from "@/components/editorial";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/shadcn/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import { Textarea } from "@/components/shadcn/ui/textarea";
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

function statusToneClassName(status: string) {
  return status === "ready" ? "text-[var(--success)]" : status === "disabled" ? "text-[var(--text-muted)]" : "text-[var(--warning)]";
}

const requiredMark = (
  <span aria-hidden="true" className="ml-1 text-[0.8125rem] font-medium text-[var(--text-muted)]">
    *
  </span>
);

function statusLabel(status: string) {
  if (status === "ready") return "可用";
  if (status === "disabled") return "已停用";
  return "待配置密钥";
}

/**
 * 按能力的默认模型单选组（方向 A）：衬线小标题 + 说明 + 语气色「已选择 / 待选择」，
 * 下面是细线分隔的单选行（名称、等宽模型 ID、语气色状态）。每种能力独立单选。
 */
function CapabilityDefaultCard({
  capability,
  models,
  defaultModel,
  switchingId,
  onSwitch,
}: {
  capability: Capability;
  models: PublicAiModelOption[];
  defaultModel?: PublicAiModelOption;
  switchingId: string | null;
  onSwitch: (model: PublicAiModelOption, capability: Capability) => void;
}) {
  const availableModels = models.filter((model) => model.capabilities.includes(capability));

  return (
    <section className="min-w-0" aria-labelledby={`ai-capability-${capability}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`ai-capability-${capability}`} className="font-serif text-base font-bold text-[var(--foreground)]">
          {capabilityLabels[capability]}
        </h3>
        <span className={cn("text-xs font-bold", defaultModel?.status === "ready" ? "text-[var(--success)]" : "text-[var(--warning)]")}>
          {defaultModel ? "已选择" : "待选择"}
        </span>
      </div>
      <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{capabilityDescriptions[capability]}</p>

      <div className="mt-3 border-t border-[var(--reader-border-strong)]">
        {availableModels.map((model) => {
          const checked = model.defaultFor.includes(capability);
          const disabled = Boolean(switchingId) || model.status !== "ready";

          return (
            <label
              key={`${capability}-${model.id}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 border-b border-[var(--border)] px-1 py-2 transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)]",
                disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
              )}
            >
              <input
                aria-label={`选择 ${capabilityLabels[capability]} ${model.name}`}
                checked={checked}
                className="grid size-4 shrink-0 cursor-pointer appearance-none place-content-center rounded-full border border-[var(--reader-border-strong)] transition-colors duration-150 before:size-2 before:scale-0 before:rounded-full before:bg-[var(--foreground)] before:transition-transform before:duration-150 before:content-[''] checked:border-[var(--foreground)] checked:before:scale-100 disabled:cursor-not-allowed motion-reduce:before:transition-none"
                disabled={disabled}
                name={`ai-model-${capability}`}
                onChange={() => onSwitch(model, capability)}
                type="radio"
                value={model.id}
              />
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="shrink-0 text-sm font-medium text-[var(--foreground)]">{model.name}</span>
                <span className="min-w-0 truncate font-mono text-xs text-[var(--text-muted)]">{model.model}</span>
              </span>
              {checked ? <span className="shrink-0 text-xs font-bold text-[var(--foreground)]">当前默认</span> : null}
              <span className={cn("shrink-0 text-xs font-bold", statusToneClassName(model.status))}>{statusLabel(model.status)}</span>
            </label>
          );
        })}
        {availableModels.length === 0 ? (
          <p className="ed-empty__title py-4">暂无支持{capabilityLabels[capability]}的模型。</p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Admin surface for model CRUD, testing, and default model selection.
 * Form state and server mutations are split into hooks so this component stays focused on layout.
 */
export function AiModelManager({ initialModels }: { initialModels: PublicAiModelOption[] }) {
  const { form, methods, startCreate, startEdit, resetForm, toggleCapability } = useModelForm();
  const { formState } = methods;
  const { isSubmitting } = formState;
  const capabilities = form?.capabilities ?? [];
  const {
    models,
    defaultSummaryModel,
    defaultCoverModel,
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

  const handleSubmit = methods.handleSubmit(async (values) => {
    await saveModel({ ...values });
  });

  const [pendingDelete, setPendingDelete] = useState<PublicAiModelOption | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-9">
      <FadeBanner message={error || message} tone={error ? "danger" : "success"} />

      <section aria-labelledby="ai-model-defaults-title">
        <AdminSectionHeader
          id="ai-model-defaults-title"
          title="按能力选择默认模型"
          description="每种能力独立单选，互不影响。"
          aside={
            <Button size="sm" type="button" variant="outline" onClick={startCreate}>
              新增模型
            </Button>
          }
        />
        <p className="mt-1.5 text-[0.8125rem] text-[var(--text-body)]">
          文章摘要：<span className="font-bold text-[var(--foreground)]">{defaultSummaryModel?.name ?? "未配置"}</span>
          <span aria-hidden="true" className="mx-1.5 text-[var(--text-muted)]">·</span>
          封面生图：<span className="font-bold text-[var(--foreground)]">{defaultCoverModel?.name ?? "未配置"}</span>
        </p>
        <div className="mt-4 grid gap-x-10 gap-y-6 xl:grid-cols-2">
          <CapabilityDefaultCard
            capability="post-summary"
            models={models}
            defaultModel={defaultSummaryModel}
            switchingId={switchingId}
            onSwitch={(model, capability) => void setDefaultModel(model, capability)}
          />
          <CapabilityDefaultCard
            capability="cover-image"
            models={models}
            defaultModel={defaultCoverModel}
            switchingId={switchingId}
            onSwitch={(model, capability) => void setDefaultModel(model, capability)}
          />
        </div>
      </section>

      {form ? (
        <Reveal as="section" aria-labelledby="ai-model-form-title" className="max-w-[760px]">
          <AdminSectionHeader
            id="ai-model-form-title"
            title={form.id ? "修改模型" : "新增模型"}
            description="编辑已有模型时，API Key 留空会保留原值。"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">保存后可立即测试连接。</p>
          <div className="pt-4">
          <Form {...methods}>
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <FormField
                  control={methods.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-baseline">
                        <FormLabel>模型名称</FormLabel>
                        {requiredMark}
                      </div>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={methods.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-baseline">
                        <FormLabel>模型 ID</FormLabel>
                        {requiredMark}
                      </div>
                      <FormControl><Input className="font-mono" placeholder="qwen3.5-flash / wan2.6-t2i" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={methods.control}
                  name="baseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-baseline">
                        <FormLabel>Base URL</FormLabel>
                        {requiredMark}
                      </div>
                      <FormControl><Input className="font-mono" placeholder="https://api.openai.com/v1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={methods.control}
                  name="requestPath"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-baseline">
                        <FormLabel>Request Path</FormLabel>
                        {requiredMark}
                      </div>
                      <FormControl><Input className="font-mono" placeholder="/chat/completions / /images/generations" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={methods.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{form.id ? "API Key（留空保持不变）" : "API Key"}</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={methods.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-baseline">
                      <FormLabel>描述</FormLabel>
                      <span className="ml-1 text-[0.8125rem] font-medium text-[var(--text-muted)]">（可选）</span>
                    </div>
                    <FormControl><Textarea className="min-h-24" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="border-b border-[var(--border)] pb-1.5 text-xs font-bold text-[var(--text-muted)]">启用与能力</p>
              <div className="grid gap-x-6 gap-y-3 lg:grid-cols-3">
                <FormField
                  control={methods.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                      </FormControl>
                      <FormLabel className="font-normal">启用模型</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={methods.control}
                  name="capabilities"
                  render={() => (
                    <FormItem className="lg:col-span-2">
                      <FormLabel>模型能力</FormLabel>
                      <FormControl>
                        <div className="grid gap-3 sm:grid-cols-2" role="group">
                          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                            <Checkbox
                              checked={capabilities.includes("post-summary")}
                              onCheckedChange={(checked) => toggleCapability("post-summary", checked === true)}
                            />
                            文章摘要能力
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                            <Checkbox
                              checked={capabilities.includes("cover-image")}
                              onCheckedChange={(checked) => toggleCapability("cover-image", checked === true)}
                            />
                            封面生图能力
                          </label>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={methods.control}
                  name="isDefaultForSummary"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          disabled={!capabilities.includes("post-summary")}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">设为文章摘要默认</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={methods.control}
                  name="isDefaultForCoverImage"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          disabled={!capabilities.includes("cover-image")}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">设为封面生图默认</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={resetForm}>
                  取消
                </Button>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "保存中..." : "保存模型"}
                </Button>
              </div>
            </form>
          </Form>
          </div>
        </Reveal>
      ) : null}

      <section aria-labelledby="ai-model-library-title">
        <AdminSectionHeader
          id="ai-model-library-title"
          title="模型库"
          count={models.length}
          description="统一维护环境变量内置模型与数据库自定义模型；默认选择按能力独立设置。"
        />
        <StaggerList className="mt-2 border-t border-[var(--reader-border-strong)]" stagger={0.04}>
          {models.map((model) => (
            <StaggerItem
              as="article"
              key={model.id}
              className="border-b border-[var(--border)] py-3.5 transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_2%,transparent)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-serif text-base font-bold text-[var(--foreground)]">{model.name}</h3>
                    <span className={cn("text-xs font-bold", statusToneClassName(model.status))}>{statusLabel(model.status)}</span>
                    {model.defaultFor.map((capability) => (
                      <span key={capability} className="text-xs font-bold text-[var(--success)]">
                        {capabilityLabels[capability]}默认
                      </span>
                    ))}
                    <span className="text-xs text-[var(--text-muted)]">{model.source === "environment" ? "环境变量" : "数据库"}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[0.8125rem] text-[var(--text-body)]">{model.description || "未填写描述。"}</p>
                </div>

                <div className="flex shrink-0 items-center gap-3.5">
                  <button
                    aria-busy={testingId === model.id || undefined}
                    className={adminTextActionClassName}
                    disabled={testingId === model.id}
                    onClick={() => void testModel(model)}
                    type="button"
                  >
                    {testingId === model.id ? "测试中" : "测试"}
                  </button>
                  <button className={adminTextActionClassName} disabled={!model.editable} onClick={() => startEdit(model)} type="button">
                    修改
                  </button>
                  <button
                    className={adminTextActionDangerClassName}
                    disabled={!model.deletable || deletingId === model.id}
                    onClick={() => {
                      setPendingDelete(model);
                      setDeleteConfirmOpen(true);
                    }}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>

              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-[var(--text-muted)]">Endpoint</dt>
                  <dd className="min-w-0 truncate font-mono text-[var(--foreground)]" title={`${model.baseUrl}${model.requestPath}`}>
                    {model.baseUrl}
                    {model.requestPath}
                  </dd>
                </div>
                <div className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-[var(--text-muted)]">Model</dt>
                  <dd className="min-w-0 truncate font-mono text-[var(--foreground)]">{model.model}</dd>
                </div>
                <div className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-[var(--text-muted)]">Secret</dt>
                  <dd className="min-w-0 truncate font-mono text-[var(--foreground)]">{model.hasApiKey ? "已配置" : model.apiKeyEnv}</dd>
                </div>
                <div className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-[var(--text-muted)]">能力</dt>
                  <dd className="min-w-0 truncate text-[var(--foreground)]">
                    {model.capabilities.map((capability) => capabilityLabels[capability] ?? capability).join(" · ")}
                  </dd>
                </div>
              </dl>
              {model.lastTestMessage ? (
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                  最近测试：
                  <span className={cn("font-bold", model.lastTestStatus === "success" ? "text-[var(--success)]" : "text-[var(--danger-foreground)]")}>
                    {model.lastTestStatus === "success" ? "通过" : "失败"}
                  </span>{" "}
                  · {model.lastTestMessage}
                </p>
              ) : null}
            </StaggerItem>
          ))}
        </StaggerList>
      </section>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        tone="danger"
        title="删除模型"
        description={pendingDelete ? `删除模型「${pendingDelete.name}」？` : ""}
        confirmLabel="确认删除"
        submitting={Boolean(pendingDelete && deletingId === pendingDelete.id)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteModel(pendingDelete);
          setDeleteConfirmOpen(false);
        }}
      />
    </div>
  );
}
