import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/api-errors";

export type AiModelCapability = "post-summary";

export type AiModelProvider = "openai-compatible";

export type AiModelSource = "environment" | "database";

export type AiModelStatus = "ready" | "missing-api-key" | "disabled";

export type AiModelTestStatus = "success" | "failed";

export interface AiModelOption {
  id: string;
  name: string;
  description: string;
  provider: AiModelProvider;
  baseUrl: string;
  requestPath: "/chat/completions";
  model: string;
  apiKey?: string;
  apiKeyEnv: string;
  baseUrlEnv: string;
  modelEnv: string;
  capabilities: AiModelCapability[];
  defaultFor: AiModelCapability[];
  source: AiModelSource;
  editable: boolean;
  deletable: boolean;
  enabled: boolean;
  status: AiModelStatus;
  hasApiKey: boolean;
  lastTestedAt?: Date | null;
  lastTestStatus?: AiModelTestStatus | null;
  lastTestMessage?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiModelMutationInput {
  name?: string;
  description?: string | null;
  baseUrl?: string;
  requestPath?: string;
  model?: string;
  apiKey?: string | null;
  capabilities?: AiModelCapability[];
  isDefaultForSummary?: boolean;
  enabled?: boolean;
}

export type PublicAiModelOption = ReturnType<typeof toPublicAiModelOption>;

type OpenAICompatibleChatPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type AiModelRecord = {
  id: string;
  name: string;
  description: string | null;
  provider: string;
  baseUrl: string;
  requestPath: string;
  model: string;
  apiKey: string | null;
  capabilities: string[];
  isDefaultForSummary: boolean;
  enabled: boolean;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AiModelDelegate = {
  findMany: (args: { orderBy: Array<Record<string, "asc" | "desc">> }) => Promise<AiModelRecord[]>;
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
  findUnique: (args: { where: { id: string } }) => Promise<AiModelRecord | null>;
  create: (args: { data: Record<string, unknown> }) => Promise<AiModelRecord>;
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<AiModelRecord>;
  updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

type AiModelClient = {
  aiModel?: AiModelDelegate;
};

const ENV_SUMMARY_MODEL_ID = "post-summary-openai-compatible";
const DASH_SCOPE_COMPAT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DASH_SCOPE_SUMMARY_MODEL = "qwen3.5-flash";
const DEFAULT_REQUEST_PATH = "/chat/completions";
const ENCRYPTED_API_KEY_PREFIX = "enc:v1:";

function getOptionalAiModelDelegate(client: AiModelClient = prisma as unknown as AiModelClient) {
  return client.aiModel;
}

function getAiModelDelegate(client?: AiModelClient) {
  const delegate = getOptionalAiModelDelegate(client);

  if (!delegate) {
    throw new ValidationError("AI model storage is not ready. Regenerate Prisma Client and restart the server.");
  }

  return delegate;
}

function isAiModelStorageUnavailable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

function aiModelStorageNotReadyError() {
  return new ValidationError("AI model storage is not ready. Apply the AI model database migration first.");
}

function getApiKeyEncryptionKey() {
  const secret =
    process.env.AI_MODEL_SECRET_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

function encryptApiKeyForStorage(apiKey: string | null | undefined) {
  if (apiKey === undefined || apiKey === null || apiKey.startsWith(ENCRYPTED_API_KEY_PREFIX)) {
    return apiKey;
  }

  const key = getApiKeyEncryptionKey();
  if (!key) {
    throw new ValidationError("AUTH_SECRET or AI_MODEL_SECRET_KEY is required before storing AI model API keys");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_API_KEY_PREFIX}${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptApiKeyFromStorage(apiKey: string | null) {
  if (!apiKey || !apiKey.startsWith(ENCRYPTED_API_KEY_PREFIX)) {
    return apiKey;
  }

  const key = getApiKeyEncryptionKey();
  if (!key) {
    return null;
  }

  const encoded = apiKey.slice(ENCRYPTED_API_KEY_PREFIX.length);
  const [iv, authTag, encrypted] = encoded.split(".");

  if (!iv || !authTag || !encrypted) {
    return null;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function resolveEnv(primary: string, fallback: string) {
  const primaryValue = process.env[primary]?.trim();
  if (primaryValue) {
    return { envName: primary, value: primaryValue };
  }

  const fallbackValue = process.env[fallback]?.trim();
  if (fallbackValue) {
    return { envName: fallback, value: fallbackValue };
  }

  return { envName: primary, value: "" };
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeRequestPath(value?: string | null) {
  const trimmed = value?.trim() || DEFAULT_REQUEST_PATH;
  return (`/${trimmed.replace(/^\/+/, "")}`.replace(/\/+$/, "") || DEFAULT_REQUEST_PATH) as "/chat/completions";
}

function normalizeCapabilities(capabilities?: string[] | null): AiModelCapability[] {
  const normalized = (capabilities ?? [])
    .filter((capability): capability is AiModelCapability => capability === "post-summary");

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["post-summary"];
}

function getStatus({ enabled, hasApiKey }: { enabled: boolean; hasApiKey: boolean }): AiModelStatus {
  if (!enabled) {
    return "disabled";
  }

  return hasApiKey ? "ready" : "missing-api-key";
}

function getEnvironmentSummaryModel(hasDatabaseDefault: boolean): AiModelOption {
  const apiKey = resolveEnv("AI_OPENAI_COMPAT_API_KEY", "DASHSCOPE_API_KEY");
  const baseUrl = resolveEnv("AI_OPENAI_COMPAT_BASE_URL", "DASHSCOPE_BASE_URL");
  const model = resolveEnv("AI_OPENAI_COMPAT_MODEL", "DASHSCOPE_MODEL");
  const hasApiKey = Boolean(apiKey.value);

  return {
    id: ENV_SUMMARY_MODEL_ID,
    name: "文章摘要生成",
    description: "用于后台编辑器的一键中文摘要，当前走 OpenAI Chat Completions 兼容接口。",
    provider: "openai-compatible",
    baseUrl: normalizeBaseUrl(baseUrl.value || DASH_SCOPE_COMPAT_BASE_URL),
    requestPath: DEFAULT_REQUEST_PATH,
    model: model.value || DASH_SCOPE_SUMMARY_MODEL,
    apiKey: apiKey.value || undefined,
    apiKeyEnv: apiKey.envName,
    baseUrlEnv: baseUrl.value ? baseUrl.envName : "DASHSCOPE_BASE_URL",
    modelEnv: model.value ? model.envName : "DASHSCOPE_MODEL",
    capabilities: ["post-summary"],
    defaultFor: hasDatabaseDefault ? [] : ["post-summary"],
    source: "environment",
    editable: false,
    deletable: false,
    enabled: true,
    hasApiKey,
    status: getStatus({ enabled: true, hasApiKey }),
  };
}

function dbModelToOption(
  model: AiModelRecord,
): AiModelOption {
  const capabilities = normalizeCapabilities(model.capabilities);
  const defaultFor =
    model.enabled && model.isDefaultForSummary && capabilities.includes("post-summary") ? ["post-summary" as const] : [];
  const apiKey = decryptApiKeyFromStorage(model.apiKey);
  const hasApiKey = Boolean(apiKey?.trim());

  return {
    id: model.id,
    name: model.name,
    description: model.description ?? "",
    provider: "openai-compatible",
    baseUrl: normalizeBaseUrl(model.baseUrl),
    requestPath: normalizeRequestPath(model.requestPath),
    model: model.model,
    apiKey: apiKey ?? undefined,
    apiKeyEnv: "database",
    baseUrlEnv: "database",
    modelEnv: "database",
    capabilities,
    defaultFor,
    source: "database",
    editable: true,
    deletable: true,
    enabled: model.enabled,
    hasApiKey,
    status: getStatus({ enabled: model.enabled, hasApiKey }),
    lastTestedAt: model.lastTestedAt,
    lastTestStatus: model.lastTestStatus === "success" || model.lastTestStatus === "failed" ? model.lastTestStatus : null,
    lastTestMessage: model.lastTestMessage,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}

function extractAssistantText(payload: OpenAICompatibleChatPayload) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function ensureMutableModel(model: AiModelOption | null) {
  if (!model) {
    throw new ValidationError("AI model not found");
  }

  if (!model.editable) {
    throw new ValidationError("Built-in environment model cannot be modified from the admin page");
  }
}

function normalizeMutationInput(input: AiModelMutationInput, existing?: AiModelOption | null) {
  const name = input.name?.trim() ?? existing?.name ?? "";
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? existing?.baseUrl ?? "");
  const requestPath = normalizeRequestPath(input.requestPath ?? existing?.requestPath);
  const model = input.model?.trim() ?? existing?.model ?? "";
  const apiKey = input.apiKey === undefined ? undefined : input.apiKey?.trim() || null;
  const description = input.description === undefined ? existing?.description ?? null : input.description?.trim() || null;
  const capabilities = input.capabilities === undefined && existing ? existing.capabilities : normalizeCapabilities(input.capabilities);
  const enabled = input.enabled ?? existing?.enabled ?? true;
  const isDefaultForSummary =
    enabled && (input.isDefaultForSummary ?? existing?.defaultFor.includes("post-summary") ?? false);

  if (!name) {
    throw new ValidationError("Model name is required");
  }

  if (!baseUrl) {
    throw new ValidationError("Base URL is required");
  }

  try {
    new URL(baseUrl);
  } catch {
    throw new ValidationError("Base URL must be a valid URL");
  }

  if (requestPath !== DEFAULT_REQUEST_PATH) {
    throw new ValidationError("Only /chat/completions is supported for now");
  }

  if (!model) {
    throw new ValidationError("Model id is required");
  }

  return {
    name,
    description,
    provider: "openai-compatible",
    baseUrl,
    requestPath,
    model,
    apiKey,
    capabilities,
    isDefaultForSummary,
    enabled,
  };
}

export async function getAiModelOptions(): Promise<AiModelOption[]> {
  const delegate = getOptionalAiModelDelegate();
  if (!delegate) {
    return [getEnvironmentSummaryModel(false)];
  }

  let records: AiModelRecord[];
  try {
    records = await delegate.findMany({
      orderBy: [{ isDefaultForSummary: "desc" }, { updatedAt: "desc" }],
    });
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      return [getEnvironmentSummaryModel(false)];
    }

    throw error;
  }

  const databaseModels = records.map(dbModelToOption);
  const hasDatabaseDefault = databaseModels.some((model) => model.enabled && model.defaultFor.includes("post-summary"));

  return [getEnvironmentSummaryModel(hasDatabaseDefault), ...databaseModels];
}

async function hasEnabledDatabaseSummaryDefault() {
  const delegate = getOptionalAiModelDelegate();
  if (!delegate) {
    return false;
  }

  try {
    return (await delegate.count({ where: { enabled: true, isDefaultForSummary: true } })) > 0;
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      return false;
    }

    throw error;
  }
}

export async function getAiModelOption(modelId: string) {
  if (modelId === ENV_SUMMARY_MODEL_ID) {
    return getEnvironmentSummaryModel(await hasEnabledDatabaseSummaryDefault());
  }

  const delegate = getOptionalAiModelDelegate();
  if (!delegate) {
    return null;
  }

  let record: AiModelRecord | null;
  try {
    record = await delegate.findUnique({ where: { id: modelId } });
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      return null;
    }

    throw error;
  }

  return record ? dbModelToOption(record) : null;
}

export async function getDefaultAiModelForCapability(capability: AiModelCapability) {
  const models = await getAiModelOptions();

  return (
    models.find((model) => model.enabled && model.defaultFor.includes(capability)) ??
    models.find((model) => model.enabled && model.capabilities.includes(capability)) ??
    null
  );
}

export async function getAiModelForCapability(capability: AiModelCapability, modelId?: string | null) {
  if (!modelId) {
    return getDefaultAiModelForCapability(capability);
  }

  const model = await getAiModelOption(modelId);
  if (!model?.enabled || !model.capabilities.includes(capability)) {
    return null;
  }

  return model;
}

export async function createAiModel(input: AiModelMutationInput) {
  getAiModelDelegate();
  const normalized = normalizeMutationInput(input);

  let record: AiModelRecord;
  try {
    record = await prisma.$transaction(async (tx) => {
      const delegate = getAiModelDelegate(tx as unknown as AiModelClient);

      if (normalized.isDefaultForSummary) {
        await delegate.updateMany({
          where: { isDefaultForSummary: true },
          data: { isDefaultForSummary: false },
        });
      }

      return delegate.create({
        data: {
          ...normalized,
          apiKey: encryptApiKeyForStorage(normalized.apiKey ?? null),
        },
      });
    });
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      throw aiModelStorageNotReadyError();
    }

    throw error;
  }

  return dbModelToOption(record);
}

export async function updateAiModel(modelId: string, input: AiModelMutationInput) {
  getAiModelDelegate();
  const existing = await getAiModelOption(modelId);
  ensureMutableModel(existing);

  const normalized = normalizeMutationInput(input, existing);

  let record: AiModelRecord;
  try {
    record = await prisma.$transaction(async (tx) => {
      const delegate = getAiModelDelegate(tx as unknown as AiModelClient);

      if (normalized.isDefaultForSummary) {
        await delegate.updateMany({
          where: { isDefaultForSummary: true, id: { not: modelId } },
          data: { isDefaultForSummary: false },
        });
      }

      return delegate.update({
        where: { id: modelId },
        data: {
          name: normalized.name,
          description: normalized.description,
          provider: normalized.provider,
          baseUrl: normalized.baseUrl,
          requestPath: normalized.requestPath,
          model: normalized.model,
          capabilities: normalized.capabilities,
          isDefaultForSummary: normalized.isDefaultForSummary,
          enabled: normalized.enabled,
          ...(normalized.apiKey !== undefined ? { apiKey: encryptApiKeyForStorage(normalized.apiKey) } : {}),
        },
      });
    });
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      throw aiModelStorageNotReadyError();
    }

    throw error;
  }

  return dbModelToOption(record);
}

export async function deleteAiModel(modelId: string) {
  const delegate = getAiModelDelegate();
  const existing = await getAiModelOption(modelId);
  ensureMutableModel(existing);

  try {
    await delegate.delete({ where: { id: modelId } });
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      throw aiModelStorageNotReadyError();
    }

    throw error;
  }
}

export async function recordAiModelTestResult(modelId: string, status: AiModelTestStatus, message: string) {
  const model = await getAiModelOption(modelId);
  if (!model?.editable) {
    return;
  }

  const delegate = getOptionalAiModelDelegate();
  if (!delegate) {
    return;
  }

  try {
    await delegate.update({
      where: { id: modelId },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: status,
        lastTestMessage: message,
      },
    });
  } catch (error) {
    if (!isAiModelStorageUnavailable(error)) {
      throw error;
    }
  }
}

export async function testAiModelConnection(model: AiModelOption) {
  if (!model.apiKey) {
    throw new ValidationError(`${model.apiKeyEnv} is not configured`);
  }

  const response = await fetch(`${model.baseUrl}${model.requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      messages: [
        { role: "system", content: "You are a concise API health check assistant." },
        { role: "user", content: "Reply with exactly: ok" },
      ],
      temperature: 0,
      max_tokens: 16,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAICompatibleChatPayload;
  const assistantText = extractAssistantText(payload);

  if (!response.ok) {
    throw new Error(payload.error?.message || `Model test failed with HTTP ${response.status}`);
  }

  if (!assistantText) {
    throw new Error("Model test returned an empty assistant message");
  }

  return assistantText;
}

export function toPublicAiModelOption(model: AiModelOption) {
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    provider: model.provider,
    baseUrl: model.baseUrl,
    requestPath: model.requestPath,
    model: model.model,
    apiKeyEnv: model.apiKeyEnv,
    baseUrlEnv: model.baseUrlEnv,
    modelEnv: model.modelEnv,
    capabilities: model.capabilities,
    defaultFor: model.defaultFor,
    source: model.source,
    editable: model.editable,
    deletable: model.deletable,
    enabled: model.enabled,
    status: model.status,
    hasApiKey: model.hasApiKey,
    lastTestedAt: model.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: model.lastTestStatus ?? null,
    lastTestMessage: model.lastTestMessage ?? null,
  };
}

export async function getPublicAiModelOptions() {
  const models = await getAiModelOptions();
  return models.map(toPublicAiModelOption);
}
