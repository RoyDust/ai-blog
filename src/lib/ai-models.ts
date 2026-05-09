/**
 * AI 模型目录与管理中心。
 *
 * 职责：
 * - 统一聚合环境变量模型与数据库自定义模型
 * - 处理模型默认项、能力匹配、启停状态和连通性测试
 * - 对数据库中保存的 API Key 做加解密封装
 * - 为后台模型管理页面提供稳定的数据视图
 *
 * 说明：
 * - 当前主要面向 OpenAI Chat Completions 兼容接口
 * - 环境变量模型是内建只读模型，数据库模型才允许后台修改
 */
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/api-errors";
import { decryptApiKeyFromStorage, encryptApiKeyForStorage } from "@/lib/ai-models-crypto";

export type AiModelCapability = "post-summary" | "cover-image";

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
  requestPath: string;
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
  isDefaultForCoverImage?: boolean;
  enabled?: boolean;
}

export type PublicAiModelOption = ReturnType<typeof toPublicAiModelOption>;

export type AiModelChatRequestExtras = {
  thinking?: {
    type: "disabled";
  };
};

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
  isDefaultForCoverImage: boolean;
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
const ENV_COVER_IMAGE_MODEL_ID = "qwen-wan2.6-image";
const DASH_SCOPE_COMPAT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DASH_SCOPE_SUMMARY_MODEL = "qwen3.5-flash";
const DEFAULT_REQUEST_PATH = "/chat/completions";
const DEFAULT_IMAGE_REQUEST_PATH = "/images/generations";

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
  return value.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
}

/**
 * 根据模型 / 服务商兼容性追加请求参数。
 * 目前主要用于 DeepSeek 兼容接口，显式关闭 thinking 扩展参数。
 */
export function getAiModelChatRequestExtras(
  model: Pick<AiModelOption, "baseUrl" | "model">,
): AiModelChatRequestExtras {
  const normalizedModel = model.model.toLowerCase();
  let hostname = "";

  try {
    hostname = new URL(model.baseUrl).hostname.toLowerCase();
  } catch {
    hostname = "";
  }

  if (hostname.endsWith("deepseek.com") || normalizedModel.startsWith("deepseek-")) {
    return { thinking: { type: "disabled" } };
  }

  return {};
}

function normalizeRequestPath(value?: string | null) {
  const trimmed = value?.trim() || DEFAULT_REQUEST_PATH;
  return `/${trimmed.replace(/^\/+/, "")}`.replace(/\/+$/, "") || DEFAULT_REQUEST_PATH;
}

function normalizeCapabilities(capabilities?: string[] | null): AiModelCapability[] {
  const normalized = (capabilities ?? [])
    .filter((capability): capability is AiModelCapability => capability === "post-summary" || capability === "cover-image");

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

function getEnvironmentCoverImageModel(hasDatabaseDefault = false): AiModelOption {
  const apiKey = resolveEnv("AI_IMAGE_DASHSCOPE_API_KEY", "DASHSCOPE_API_KEY");
  const baseUrl = resolveEnv("AI_IMAGE_DASHSCOPE_BASE_URL", "DASHSCOPE_IMAGE_BASE_URL");
  const model = resolveEnv("AI_IMAGE_DASHSCOPE_MODEL", "DASHSCOPE_IMAGE_MODEL");
  const hasApiKey = Boolean(apiKey.value);

  return {
    id: ENV_COVER_IMAGE_MODEL_ID,
    name: "千问 Wan 2.6 生图",
    description: "用于文章封面的 AI 生图模型。默认按 DashScope 异步生图接口调用。",
    provider: "openai-compatible",
    baseUrl: normalizeBaseUrl(baseUrl.value || "https://dashscope.aliyuncs.com/api/v1"),
    requestPath: process.env.AI_IMAGE_DASHSCOPE_REQUEST_PATH?.trim() || "/services/aigc/image-generation/generation",
    model: model.value || "wan2.6-t2i",
    apiKey: apiKey.value || undefined,
    apiKeyEnv: apiKey.envName,
    baseUrlEnv: baseUrl.value ? baseUrl.envName : "AI_IMAGE_DASHSCOPE_BASE_URL",
    modelEnv: model.value ? model.envName : "AI_IMAGE_DASHSCOPE_MODEL",
    capabilities: ["cover-image"],
    defaultFor: hasDatabaseDefault ? [] : ["cover-image"],
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
  const apiKey = decryptApiKeyFromStorage(model.apiKey);
  const hasApiKey = Boolean(apiKey?.trim());
  const defaultFor: AiModelCapability[] = [];
  if (model.enabled && hasApiKey && model.isDefaultForSummary && capabilities.includes("post-summary")) {
    defaultFor.push("post-summary");
  }
  if (model.enabled && hasApiKey && model.isDefaultForCoverImage && capabilities.includes("cover-image")) {
    defaultFor.push("cover-image");
  }

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

function ensureMutableModel(model: AiModelOption | null): asserts model is AiModelOption {
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
    enabled && capabilities.includes("post-summary") && (input.isDefaultForSummary ?? existing?.defaultFor.includes("post-summary") ?? false);
  const isDefaultForCoverImage =
    enabled && capabilities.includes("cover-image") && (input.isDefaultForCoverImage ?? existing?.defaultFor.includes("cover-image") ?? false);

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

  const allowedPaths = new Set([DEFAULT_REQUEST_PATH, DEFAULT_IMAGE_REQUEST_PATH, "/services/aigc/image-generation/generation"]);
  if (!allowedPaths.has(requestPath)) {
    throw new ValidationError("Only /chat/completions, /images/generations and DashScope image generation paths are supported for now");
  }

  if (capabilities.includes("cover-image") && requestPath === DEFAULT_REQUEST_PATH && !capabilities.includes("post-summary")) {
    throw new ValidationError("Cover image models must use an image generation endpoint");
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
    isDefaultForCoverImage,
    enabled,
  };
}

/**
 * 返回后台可见的完整模型列表。
 * 会把环境变量模型与数据库模型合并，并处理默认模型优先级。
 */
export async function getAiModelOptions(): Promise<AiModelOption[]> {
  const delegate = getOptionalAiModelDelegate();
  if (!delegate) {
    return [getEnvironmentSummaryModel(false), getEnvironmentCoverImageModel()];
  }

  let records: AiModelRecord[];
  try {
    records = await delegate.findMany({
      orderBy: [{ isDefaultForSummary: "desc" }, { updatedAt: "desc" }],
    });
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      return [getEnvironmentSummaryModel(false), getEnvironmentCoverImageModel()];
    }

    throw error;
  }

  const databaseModels = records.map(dbModelToOption);
  const hasDatabaseSummaryDefault = databaseModels.some((model) => model.enabled && model.defaultFor.includes("post-summary"));
  const hasDatabaseCoverDefault = databaseModels.some((model) => model.enabled && model.defaultFor.includes("cover-image"));

  return [getEnvironmentSummaryModel(hasDatabaseSummaryDefault), ...databaseModels, getEnvironmentCoverImageModel(hasDatabaseCoverDefault)];
}

async function hasReadyDatabaseDefaultForCapability(capability: AiModelCapability) {
  const delegate = getOptionalAiModelDelegate();
  if (!delegate) {
    return false;
  }

  try {
    const records = await delegate.findMany({
      orderBy: [{ isDefaultForSummary: "desc" }, { updatedAt: "desc" }],
    });

    return records.map(dbModelToOption).some((model) => model.defaultFor.includes(capability));
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      return false;
    }

    throw error;
  }
}

/**
 * 按 id 读取单个模型。
 * 支持读取内建环境变量模型，也支持读取数据库模型。
 */
export async function getAiModelOption(modelId: string) {
  if (modelId === ENV_SUMMARY_MODEL_ID) {
    return getEnvironmentSummaryModel(await hasReadyDatabaseDefaultForCapability("post-summary"));
  }

  if (modelId === ENV_COVER_IMAGE_MODEL_ID) {
    return getEnvironmentCoverImageModel(await hasReadyDatabaseDefaultForCapability("cover-image"));
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

/**
 * 为指定能力挑选默认模型。
 * 优先使用 ready 且显式设为默认的模型，其次回退到同能力下第一个可用模型。
 */
export async function getDefaultAiModelForCapability(capability: AiModelCapability) {
  const models = await getAiModelOptions();

  return (
    models.find((model) => model.status === "ready" && model.defaultFor.includes(capability)) ??
    models.find((model) => model.status === "ready" && model.capabilities.includes(capability)) ??
    null
  );
}

/**
 * 为某项能力解析最终可用模型。
 * 若传入 modelId，则验证该模型是否可用且具备所需能力；否则回退到默认模型。
 */
export async function getAiModelForCapability(capability: AiModelCapability, modelId?: string | null) {
  if (!modelId) {
    return getDefaultAiModelForCapability(capability);
  }

  const model = await getAiModelOption(modelId);
  if (!model || model.status !== "ready" || !model.capabilities.includes(capability)) {
    return null;
  }

  return model;
}

/**
 * 设置某项能力的默认模型。
 *
 * 注意：
 * - 同一能力同一时刻只允许一个默认模型
 * - 环境变量模型也可以成为默认项，但它本身不可在后台编辑
 */
export async function setDefaultAiModelForCapability(capability: AiModelCapability, modelId: string) {
  if (capability !== "post-summary" && capability !== "cover-image") {
    throw new ValidationError("Unsupported AI model capability");
  }

  const defaultField = capability === "post-summary" ? "isDefaultForSummary" : "isDefaultForCoverImage";
  const environmentModelId = capability === "post-summary" ? ENV_SUMMARY_MODEL_ID : ENV_COVER_IMAGE_MODEL_ID;
  const getEnvironmentModel = capability === "post-summary"
    ? () => getEnvironmentSummaryModel(false)
    : getEnvironmentCoverImageModel;
  const delegate = getOptionalAiModelDelegate();

  if (modelId === environmentModelId) {
    const environmentModel = getEnvironmentModel();
    if (environmentModel.status !== "ready") {
      throw new ValidationError(`${environmentModel.apiKeyEnv} is not configured`);
    }

    if (!delegate) {
      return environmentModel;
    }

    try {
      await delegate.updateMany({
        where: { [defaultField]: true },
        data: { [defaultField]: false },
      });
    } catch (error) {
      if (isAiModelStorageUnavailable(error)) {
        return environmentModel;
      }

      throw error;
    }

    return environmentModel;
  }

  const model = await getAiModelOption(modelId);
  ensureMutableModel(model);

  if (!model.enabled || !model.capabilities.includes(capability)) {
    throw new ValidationError("AI model is not available for this capability");
  }

  if (!model.hasApiKey) {
    throw new ValidationError("AI model API key is not configured");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const txDelegate = getAiModelDelegate(tx as unknown as AiModelClient);
      await txDelegate.updateMany({
        where: { [defaultField]: true, id: { not: modelId } },
        data: { [defaultField]: false },
      });

      const record = await txDelegate.update({
        where: { id: modelId },
        data: {
          enabled: true,
          [defaultField]: true,
        },
      });

      return dbModelToOption(record);
    });
  } catch (error) {
    if (isAiModelStorageUnavailable(error)) {
      throw aiModelStorageNotReadyError();
    }

    throw error;
  }
}

/**
 * 创建数据库模型配置。
 * 创建时会校验能力与请求路径组合是否合法，并按需重置旧的默认模型。
 */
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

      if (normalized.isDefaultForCoverImage) {
        await delegate.updateMany({
          where: { isDefaultForCoverImage: true },
          data: { isDefaultForCoverImage: false },
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

/**
 * 更新数据库模型配置。
 * 若包含默认能力切换，会在事务中同步取消其他模型的默认标记。
 */
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

      if (normalized.isDefaultForCoverImage) {
        await delegate.updateMany({
          where: { isDefaultForCoverImage: true, id: { not: modelId } },
          data: { isDefaultForCoverImage: false },
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
          isDefaultForCoverImage: normalized.isDefaultForCoverImage,
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

/**
 * 删除数据库模型配置。
 * 仅允许删除可编辑的数据库模型，不允许删除内建环境变量模型。
 */
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

/**
 * 对模型做轻量连通性测试。
 * 文本模型会发起一次极小的 health-check 请求；纯生图模型只做配置完整性校验。
 */
export async function testAiModelConnection(model: AiModelOption) {
  if (!model.apiKey) {
    throw new ValidationError(`${model.apiKeyEnv} is not configured`);
  }

  if (model.capabilities.includes("cover-image") && !model.capabilities.includes("post-summary")) {
    return "图片生成模型配置完整，实际连通性将在生成封面时验证。";
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
      ...getAiModelChatRequestExtras(model),
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

/**
 * 把内部模型对象转换成可返回给前端的公开版本。
 * 会保留状态与来源信息，但不会暴露真实 API Key。
 */
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

/**
 * 返回前端管理页面消费的公开模型列表。
 */
export async function getPublicAiModelOptions() {
  const models = await getAiModelOptions();
  return models.map(toPublicAiModelOption);
}
