"use client";

import { useMemo, useState } from "react";

import { readApiJson } from "@/lib/admin-api-client";
import type { PublicAiModelOption } from "@/lib/ai-models";

import type { Capability, ModelFormState } from "./useModelForm";

const capabilityLabels: Record<Capability, string> = {
  "post-summary": "文章摘要",
  "cover-image": "封面生图",
};

type UseModelActionsOptions = {
  onSaveSuccess: () => void;
};

function buildModelPayload(form: ModelFormState) {
  return {
    name: form.name,
    description: form.description,
    baseUrl: form.baseUrl,
    requestPath: form.requestPath,
    model: form.model,
    apiKey: form.apiKey || undefined,
    capabilities: form.capabilities,
    isDefaultForSummary: form.capabilities.includes("post-summary") && form.isDefaultForSummary,
    isDefaultForCoverImage: form.capabilities.includes("cover-image") && form.isDefaultForCoverImage,
    enabled: form.enabled,
  };
}

export function useModelActions(
  initialModels: PublicAiModelOption[],
  { onSaveSuccess }: UseModelActionsOptions,
) {
  const [models, setModels] = useState(initialModels);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const defaultSummaryModel = useMemo(
    () => models.find((model) => model.defaultFor.includes("post-summary")),
    [models],
  );
  const defaultCoverModel = useMemo(
    () => models.find((model) => model.defaultFor.includes("cover-image")),
    [models],
  );

  const refreshModels = async () => {
    const data = await readApiJson<{ data?: unknown }>(await fetch("/api/admin/ai/models"));
    setModels(Array.isArray(data.data) ? data.data : []);
  };

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const saveModel = async (form: ModelFormState) => {
    setSaving(true);
    clearFeedback();

    try {
      const response = form.id
        ? await fetch(`/api/admin/ai/models/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildModelPayload(form)),
          })
        : await fetch("/api/admin/ai/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildModelPayload(form)),
          });

      await readApiJson(response);
      await refreshModels();
      onSaveSuccess();
      setMessage(form.id ? "模型已更新。" : "模型已创建。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteModel = async (model: PublicAiModelOption) => {
    if (!model.deletable) return;
    if (!window.confirm(`删除模型「${model.name}」？`)) return;

    setDeletingId(model.id);
    clearFeedback();

    try {
      await readApiJson(await fetch(`/api/admin/ai/models/${model.id}`, { method: "DELETE" }));
      await refreshModels();
      setMessage("模型已删除。");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const testModel = async (model: PublicAiModelOption) => {
    setTestingId(model.id);
    clearFeedback();

    try {
      const data = await readApiJson<{ data?: { message?: string } }>(
        await fetch(`/api/admin/ai/models/${model.id}/test`, { method: "POST" }),
      );
      await refreshModels();
      setMessage(data.data?.message || "模型测试通过。");
    } catch (testError) {
      await refreshModels().catch(() => undefined);
      setError(testError instanceof Error ? testError.message : "模型测试失败");
    } finally {
      setTestingId(null);
    }
  };

  const setDefaultModel = async (model: PublicAiModelOption, capability: Capability) => {
    if (model.defaultFor.includes(capability) || switchingId) return;

    setSwitchingId(`${capability}:${model.id}`);
    clearFeedback();

    try {
      await readApiJson(
        await fetch("/api/admin/ai/models/default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: model.id, capability }),
        }),
      );
      await refreshModels();
      setMessage(`已将${capabilityLabels[capability]}切换为「${model.name}」。`);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "切换模型失败");
    } finally {
      setSwitchingId(null);
    }
  };

  return {
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
  };
}
