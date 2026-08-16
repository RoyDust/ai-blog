"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import type { PublicAiModelOption } from "@/lib/ai-models";

export type Capability = "post-summary" | "cover-image";

/** 兼容旧名称：useModelActions 仍以该名消费表单类型。 */
export type ModelFormState = ModelFormValues;

export type ModelFormValues = {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  requestPath: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  capabilities: Capability[];
  isDefaultForSummary: boolean;
  isDefaultForCoverImage: boolean;
};

const modelFormSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "请输入模型名称").max(80, "模型名称最多 80 字"),
  description: z.string().max(500, "描述最多 500 字"),
  baseUrl: z.string().trim().min(1, "请输入 Base URL").url("Base URL 格式不正确"),
  requestPath: z.string().trim().min(1, "请输入 Request Path"),
  model: z.string().trim().min(1, "请输入模型 ID"),
  apiKey: z.string(),
  enabled: z.boolean(),
  capabilities: z.array(z.enum(["post-summary", "cover-image"])).min(1, "至少选择一个能力"),
  isDefaultForSummary: z.boolean(),
  isDefaultForCoverImage: z.boolean(),
});

const emptyForm: ModelFormValues = {
  id: "",
  name: "",
  description: "",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  requestPath: "/chat/completions",
  model: "",
  apiKey: "",
  enabled: true,
  capabilities: ["post-summary"],
  isDefaultForSummary: false,
  isDefaultForCoverImage: false,
};

/**
 * Returns a fresh form object so capability arrays cannot be shared across openings.
 */
function createEmptyForm(): ModelFormValues {
  return { ...emptyForm, capabilities: [...emptyForm.capabilities] };
}

/**
 * Maps the public model shape back into the editable form shape.
 * API keys are intentionally blank so editing a model does not leak stored secrets.
 */
function formFromModel(model: PublicAiModelOption): ModelFormValues {
  const capabilities = model.capabilities.filter(
    (capability): capability is Capability => capability === "post-summary" || capability === "cover-image",
  );

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    baseUrl: model.baseUrl,
    requestPath: model.requestPath,
    model: model.model,
    apiKey: "",
    enabled: model.enabled,
    capabilities,
    isDefaultForSummary: model.defaultFor.includes("post-summary"),
    isDefaultForCoverImage: model.defaultFor.includes("cover-image"),
  };
}

/**
 * Owns the model form with React Hook Form + Zod。
 *
 * RHF 是唯一数据源：`form` 由 `useWatch()` 派生；字段通过 FormField 写入，
 * 能力组合规则集中在 `toggleCapability` 中维护。
 * 提交与校验由 `methods.handleSubmit` 承担，错误经 `methods.formState.errors` 读取。
 */
export function useModelForm() {
  const methods = useForm<ModelFormValues>({
    resolver: zodResolver(modelFormSchema),
    defaultValues: createEmptyForm(),
  });
  const { reset, setValue } = methods;
  const [open, setOpen] = useState(false);

  // Every field has a concrete default and every reset supplies the complete shape.
  const watchedForm = useWatch({ control: methods.control }) as ModelFormValues;
  const form = open ? watchedForm : null;

  const startCreate = () => {
    reset(createEmptyForm());
    setOpen(true);
  };

  const startEdit = (model: PublicAiModelOption) => {
    reset(formFromModel(model));
    setOpen(true);
  };

  const resetForm = () => setOpen(false);

  const toggleCapability = (capability: Capability, checked: boolean) => {
    const current = methods.getValues();
    const nextCapabilities = checked
      ? Array.from(new Set([...current.capabilities, capability]))
      : current.capabilities.filter((item) => item !== capability);
    const fallbackCapability: Capability = capability === "post-summary" ? "cover-image" : "post-summary";

    setValue("capabilities", nextCapabilities.length ? nextCapabilities : [fallbackCapability], { shouldDirty: true });

    if (capability === "post-summary" && !checked) {
      setValue("isDefaultForSummary", false, { shouldDirty: true });
    }

    if (capability === "cover-image" && !checked) {
      setValue("isDefaultForCoverImage", false, { shouldDirty: true });
    }
  };

  return {
    form,
    methods,
    startCreate,
    startEdit,
    resetForm,
    toggleCapability,
  };
}
