"use client";

import { useState } from "react";

import type { PublicAiModelOption } from "@/lib/ai-models";

export type Capability = "post-summary" | "cover-image";

export type ModelFormState = {
  id?: string;
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

const emptyForm: ModelFormState = {
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
function createEmptyForm(): ModelFormState {
  return { ...emptyForm, capabilities: [...emptyForm.capabilities] };
}

/**
 * Maps the public model shape back into the editable form shape.
 * API keys are intentionally blank so editing a model does not leak stored secrets.
 */
function formFromModel(model: PublicAiModelOption): ModelFormState {
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
 * Owns transient model form state and capability toggling rules.
 * Persistent list mutations are kept in useModelActions.
 */
export function useModelForm() {
  const [form, setForm] = useState<ModelFormState | null>(null);

  const startCreate = () => setForm(createEmptyForm());
  const startEdit = (model: PublicAiModelOption) => setForm(formFromModel(model));
  const resetForm = () => setForm(null);

  const updateFormField = <Field extends keyof ModelFormState>(
    field: Field,
    value: ModelFormState[Field],
  ) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const toggleCapability = (capability: Capability, checked: boolean) => {
    setForm((prev) => {
      if (!prev) return prev;

      const nextCapabilities = checked
        ? Array.from(new Set([...prev.capabilities, capability]))
        : prev.capabilities.filter((item) => item !== capability);
      const fallbackCapability: Capability = capability === "post-summary" ? "cover-image" : "post-summary";

      return {
        ...prev,
        capabilities: nextCapabilities.length ? nextCapabilities : [fallbackCapability],
        isDefaultForSummary: capability === "post-summary" && !checked ? false : prev.isDefaultForSummary,
        isDefaultForCoverImage:
          capability === "cover-image" && !checked ? false : prev.isDefaultForCoverImage,
      };
    });
  };

  return {
    form,
    setForm,
    startCreate,
    startEdit,
    resetForm,
    updateFormField,
    toggleCapability,
  };
}
