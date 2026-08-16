"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { apiFetcher, apiMutate, toErrorMessage } from "@/lib/client-api";
import type { PublicAiModelOption } from "@/lib/ai-models";

import type { Capability, ModelFormState } from "./useModelForm";

const capabilityLabels: Record<Capability, string> = {
  "post-summary": "文章摘要",
  "cover-image": "封面生图",
};

type UseModelActionsOptions = {
  onSaveSuccess: () => void;
};

type ModelsResponse = {
  success: true;
  data: PublicAiModelOption[];
};

/**
 * Converts UI form state into the API write contract.
 * Default flags are only sent when the model advertises the matching capability.
 */
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

/**
 * Owns the persisted AI model list and all server mutations for it.
 * The caller supplies form reset behavior so form lifecycle stays outside this hook.
 */
export function useModelActions(
  initialModels: PublicAiModelOption[],
  { onSaveSuccess }: UseModelActionsOptions,
) {
  const { data, mutate } = useSWR<ModelsResponse>("/api/admin/ai/models", apiFetcher, {
    fallbackData: { success: true, data: initialModels },
    revalidateOnMount: false,
  });
  const models = data?.data ?? initialModels;
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

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const saveModel = async (form: ModelFormState) => {
    clearFeedback();

    try {
      if (form.id) {
        await apiMutate(`/api/admin/ai/models/${form.id}`, {
            method: "PATCH",
            body: JSON.stringify(buildModelPayload(form)),
          });
      } else {
        await apiMutate("/api/admin/ai/models", {
            method: "POST",
            body: JSON.stringify(buildModelPayload(form)),
          });
      }

      await mutate();
      onSaveSuccess();
      setMessage(form.id ? "模型已更新。" : "模型已创建。");
    } catch (submitError) {
      setError(toErrorMessage(submitError, "保存失败"));
    }
  };

  const deleteModel = async (model: PublicAiModelOption) => {
    if (!model.deletable) return;
    if (!window.confirm(`删除模型「${model.name}」？`)) return;

    setDeletingId(model.id);
    clearFeedback();

    try {
      await apiMutate(`/api/admin/ai/models/${model.id}`, { method: "DELETE" });
      await mutate();
      setMessage("模型已删除。");
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, "删除失败"));
    } finally {
      setDeletingId(null);
    }
  };

  const testModel = async (model: PublicAiModelOption) => {
    setTestingId(model.id);
    clearFeedback();

    try {
      const result = await apiMutate<{ data?: { message?: string } }>(`/api/admin/ai/models/${model.id}/test`, {
        method: "POST",
      });
      await mutate();
      setMessage(result.data?.message || "模型测试通过。");
    } catch (testError) {
      await mutate().catch(() => undefined);
      setError(toErrorMessage(testError, "模型测试失败"));
    } finally {
      setTestingId(null);
    }
  };

  const setDefaultModel = async (model: PublicAiModelOption, capability: Capability) => {
    if (model.defaultFor.includes(capability) || switchingId) return;

    setSwitchingId(`${capability}:${model.id}`);
    clearFeedback();

    try {
      await apiMutate("/api/admin/ai/models/default", {
        method: "POST",
        body: JSON.stringify({ modelId: model.id, capability }),
      });
      await mutate();
      setMessage(`已将${capabilityLabels[capability]}切换为「${model.name}」。`);
    } catch (switchError) {
      setError(toErrorMessage(switchError, "切换模型失败"));
    } finally {
      setSwitchingId(null);
    }
  };

  return {
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
  };
}
