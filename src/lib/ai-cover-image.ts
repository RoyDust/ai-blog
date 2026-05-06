import type { CoverAssetRecord } from "@/lib/cover-assets";
import { createCoverAsset } from "@/lib/cover-assets";
import { ValidationError } from "@/lib/api-errors";
import { getAiModelForCapability, type AiModelOption } from "@/lib/ai-models";
import { uploadBufferToQiniu } from "@/lib/qiniu-server";

export type AiCoverSize = "16:9" | "1:1" | "4:3";

export type GenerateAiCoverInput = {
  title: string;
  excerpt?: string | null;
  content?: string | null;
  prompt?: string | null;
  modelId?: string | null;
  size?: AiCoverSize;
  createdById: string;
};

type DashScopeMessagePart = {
  type?: string;
  image?: string;
  url?: string;
  b64_json?: string;
};

type ImageGenerationPayload = {
  data?: Array<{ url?: string; b64_json?: string }>;
  output?: {
    results?: Array<{ url?: string; b64_json?: string }>;
    task_id?: string;
    task_status?: string;
    code?: string;
    message?: string;
    choices?: Array<{
      message?: {
        content?: DashScopeMessagePart[];
      };
    }>;
  };
  error?: { message?: string };
  message?: string;
};

const sizeMap: Record<AiCoverSize, string> = {
  "16:9": "1280x720",
  "4:3": "1024x768",
  "1:1": "1024x1024",
};

const dashScopeSizeMap: Record<AiCoverSize, string> = {
  "16:9": "1280*720",
  "4:3": "1024*768",
  "1:1": "1024*1024",
};

function truncate(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

export function buildCoverImagePrompt(input: Pick<GenerateAiCoverInput, "title" | "excerpt" | "content" | "prompt">) {
  const title = truncate(input.title, 160);
  const excerpt = truncate(input.excerpt, 500);
  const content = truncate(input.content, 800);
  const prompt = truncate(input.prompt, 500);

  return [
    "Create a high-quality editorial blog cover image, clean cinematic composition, no text, no logo, no watermark.",
    "Use a modern technology and knowledge-sharing visual style with atmospheric lighting.",
    title ? `Topic: ${title}` : null,
    excerpt ? `Summary: ${excerpt}` : null,
    !excerpt && content ? `Article context: ${content}` : null,
    prompt ? `Additional style direction: ${prompt}` : null,
    "The image should work as a 16:9 article hero cover and remain readable when cropped.",
  ].filter(Boolean).join("\n");
}

function parseGeneratedImage(payload: ImageGenerationPayload) {
  const item = payload.data?.[0] ?? payload.output?.results?.[0];
  if (item?.url) return { type: "url" as const, value: item.url };
  if (item?.b64_json) return { type: "base64" as const, value: item.b64_json };

  const contentItem = payload.output?.choices?.flatMap((choice) => choice.message?.content ?? [])
    .find((part) => part.image || part.url || part.b64_json);
  if (contentItem?.image || contentItem?.url) return { type: "url" as const, value: contentItem.image ?? contentItem.url ?? "" };
  if (contentItem?.b64_json) return { type: "base64" as const, value: contentItem.b64_json };

  return null;
}

async function imageToBuffer(image: { type: "url" | "base64"; value: string }) {
  if (image.type === "base64") {
    return { buffer: Buffer.from(image.value, "base64"), contentType: "image/png" };
  }

  const response = await fetch(image.value, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`Generated image download failed with HTTP ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
  };
}

function isDashScopeNativeImageModel(model: AiModelOption) {
  return new URL(model.baseUrl).hostname.toLowerCase().endsWith("dashscope.aliyuncs.com") && model.requestPath.includes("/services/aigc/image-generation/generation");
}

async function pollDashScopeImageTask(model: AiModelOption, taskId: string) {
  const taskUrl = `${model.baseUrl.replace(/\/api\/v1\/?$/, "/api/v1")}/tasks/${taskId}`;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const response = await fetch(taskUrl, {
      headers: { Authorization: `Bearer ${model.apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    const payload = (await response.json().catch(() => ({}))) as ImageGenerationPayload;
    if (!response.ok) {
      throw new Error(payload.error?.message || payload.message || `Image task polling failed with HTTP ${response.status}`);
    }

    if (payload.output?.task_status === "SUCCEEDED") {
      const image = parseGeneratedImage(payload);
      if (!image) throw new Error("Image generation returned no image");
      return imageToBuffer(image);
    }

    if (payload.output?.task_status === "FAILED" || payload.output?.task_status === "CANCELED") {
      throw new Error(payload.output.message || payload.message || `Image generation task ${payload.output.task_status.toLowerCase()}`);
    }
  }

  throw new Error("Image generation task timed out");
}

async function callDashScopeNativeImageModel(model: AiModelOption, prompt: string, size: AiCoverSize) {
  const response = await fetch(`${model.baseUrl}${model.requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: model.model,
      input: {
        messages: [{ role: "user", content: [{ text: prompt }] }],
      },
      parameters: {
        size: dashScopeSizeMap[size],
        n: 1,
        enable_interleave: true,
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const payload = (await response.json().catch(() => ({}))) as ImageGenerationPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `Image generation failed with HTTP ${response.status}`);
  }

  const taskId = payload.output?.task_id;
  if (!taskId) {
    const image = parseGeneratedImage(payload);
    if (!image) throw new Error("Image generation returned no task or image");
    return imageToBuffer(image);
  }

  return pollDashScopeImageTask(model, taskId);
}

async function callOpenAICompatibleImageModel(model: AiModelOption, prompt: string, size: AiCoverSize) {
  const response = await fetch(`${model.baseUrl}${model.requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      prompt,
      size: sizeMap[size],
      n: 1,
      response_format: "url",
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const payload = (await response.json().catch(() => ({}))) as ImageGenerationPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `Image generation failed with HTTP ${response.status}`);
  }

  const image = parseGeneratedImage(payload);
  if (!image) {
    throw new Error("Image generation returned no image");
  }

  return imageToBuffer(image);
}

async function callImageModel(model: AiModelOption, prompt: string, size: AiCoverSize) {
  if (!model.apiKey) {
    throw new ValidationError(`${model.apiKeyEnv} is not configured`);
  }

  return isDashScopeNativeImageModel(model)
    ? callDashScopeNativeImageModel(model, prompt, size)
    : callOpenAICompatibleImageModel(model, prompt, size);
}

export async function generateAiCoverImage(input: GenerateAiCoverInput): Promise<CoverAssetRecord> {
  const title = truncate(input.title, 160);
  if (!title) {
    throw new ValidationError("Title is required before generating a cover image");
  }

  const size = input.size ?? "16:9";
  const model = await getAiModelForCapability("cover-image", input.modelId);
  if (!model) {
    throw new ValidationError("No available cover image model is configured");
  }

  const finalPrompt = buildCoverImagePrompt(input);
  const image = await callImageModel(model, finalPrompt, size);
  const uploaded = await uploadBufferToQiniu({ buffer: image.buffer, contentType: image.contentType, keyPrefix: "covers/ai" });

  return createCoverAsset({
    url: uploaded.url,
    key: uploaded.key,
    provider: "qiniu",
    source: "ai",
    status: "active",
    title: `${title} AI 封面`,
    alt: title,
    description: "AI 生成封面",
    tags: ["ai", "generated"],
    aiPrompt: finalPrompt,
    aiModelId: model.id,
    metadata: {
      model: model.model,
      size,
      requestPath: model.requestPath,
      contentType: image.contentType,
    },
    createdById: input.createdById,
  });
}
