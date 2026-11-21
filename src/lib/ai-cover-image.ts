import {
  ReliabilityError,
  cancelResponseBody,
  readResponseBodyBounded,
  readResponseBytesBounded,
  scrubUpstreamDiagnostic,
} from "@/lib/external-reliability";
import type { CoverAssetRecord } from "@/lib/cover-assets";
import { createCoverAsset } from "@/lib/cover-assets";
import { withAiInfrastructure } from "@/lib/ai-task-errors";
import { ValidationError } from "@/lib/api-errors";
import { getAiModelForCapability, type AiModelOption } from "@/lib/ai-models";
import { QINIU_UPLOAD_MAX_FILE_SIZE_BYTES, uploadBufferToQiniu } from "@/lib/qiniu-server";
import { safeOutboundFetch, validateOutboundUrl, type SsrfGuardOptions } from "@/lib/ssrf-guard";

export type AiCoverSize = "16:9" | "1:1" | "4:3";

export type SupportedCoverImageMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif"
  | "image/avif";

export type GenerateAiCoverInput = {
  title: string;
  excerpt?: string | null;
  content?: string | null;
  prompt?: string | null;
  modelId?: string | null;
  size?: AiCoverSize;
  createdById: string;
};

export interface AiCoverImageRuntimeOptions extends SsrfGuardOptions {
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

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

export const IMAGE_RESPONSE_MAX_BYTES = QINIU_UPLOAD_MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024;
export const IMAGE_JSON_MAX_BYTES = 16 * 1024 * 1024;
export const MAX_COVER_IMAGE_DIMENSION = 16_384;
const MAX_BASE64_CHAR_LENGTH = Math.ceil((IMAGE_RESPONSE_MAX_BYTES * 4) / 3) + 64;
const SAFE_TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

async function readImageJson(response: Response, secrets?: readonly string[]): Promise<ImageGenerationPayload> {
  try {
    const raw = await readResponseBodyBounded(response, { maxBytes: IMAGE_JSON_MAX_BYTES, secrets });
    return JSON.parse(raw) as ImageGenerationPayload;
  } catch (error) {
    if (response.ok && error instanceof ReliabilityError && error.kind === "response-too-large") {
      throw error;
    }
    return {};
  }
}

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

function asciiFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function hasPrefixBytes(bytes: Uint8Array, expected: readonly number[]): boolean {
  if (bytes.byteLength < expected.length) return false;
  return expected.every((value, index) => bytes[index] === value);
}

function isGifMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 6) return false;
  const header = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!, bytes[4]!, bytes[5]!);
  return header === "GIF87a" || header === "GIF89a";
}

function isAvifMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12 || asciiFourCC(bytes, 4) !== "ftyp") {
    return false;
  }
  const majorBrand = asciiFourCC(bytes, 8);
  if (majorBrand === "avif" || majorBrand === "avis") {
    return true;
  }
  const rawBoxSize = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  const scanEnd = Math.min(bytes.byteLength, rawBoxSize >= 16 ? rawBoxSize : 64, 128);
  for (let offset = 16; offset + 4 <= scanEnd; offset += 4) {
    const brand = asciiFourCC(bytes, offset);
    if (brand === "avif" || brand === "avis") {
      return true;
    }
  }
  return false;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0);
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 8) | bytes[offset + 1]!) >>> 0;
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8)) >>> 0;
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)) >>> 0;
}

function hasValidDimensions(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= 1 &&
    width <= MAX_COVER_IMAGE_DIMENSION &&
    height >= 1 &&
    height <= MAX_COVER_IMAGE_DIMENSION
  );
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasPrefixBytes(bytes, PNG_MAGIC) || bytes.byteLength < 24) {
    return null;
  }
  const ihdrLength = readUint32BE(bytes, 8);
  if (ihdrLength < 13 || asciiFourCC(bytes, 12) !== "IHDR") {
    return null;
  }
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  return hasValidDimensions(width, height) ? { width, height } : null;
}

function parseGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isGifMagic(bytes) || bytes.byteLength < 10) {
    return null;
  }
  const width = readUint16LE(bytes, 6);
  const height = readUint16LE(bytes, 8);
  return hasValidDimensions(width, height) ? { width, height } : null;
}

function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 25 || asciiFourCC(bytes, 0) !== "RIFF" || asciiFourCC(bytes, 8) !== "WEBP") {
    return null;
  }
  const chunkType = asciiFourCC(bytes, 12);
  if (chunkType === "VP8 ") {
    if (bytes.byteLength < 30 || bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    const width = readUint16LE(bytes, 26) & 0x3fff;
    const height = readUint16LE(bytes, 28) & 0x3fff;
    return hasValidDimensions(width, height) ? { width, height } : null;
  }
  if (chunkType === "VP8L") {
    if (bytes.byteLength < 25 || bytes[20] !== 0x2f) {
      return null;
    }
    const bits = (bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24)) >>> 0;
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return hasValidDimensions(width, height) ? { width, height } : null;
  }
  if (chunkType === "VP8X") {
    if (bytes.byteLength < 30) {
      return null;
    }
    const width = readUint24LE(bytes, 24) + 1;
    const height = readUint24LE(bytes, 27) + 1;
    return hasValidDimensions(width, height) ? { width, height } : null;
  }
  return null;
}

function isJpegSofMarker(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasPrefixBytes(bytes, [0xff, 0xd8, 0xff]) || bytes.byteLength < 11) {
    return null;
  }
  let offset = 2;
  const maxScan = Math.min(bytes.byteLength, 256 * 1024);
  while (offset + 3 < maxScan) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    while (offset < maxScan && bytes[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= maxScan) {
      return null;
    }
    const marker = bytes[offset]!;
    offset += 1;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }
    if (offset + 1 >= bytes.byteLength) {
      return null;
    }
    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2) {
      return null;
    }
    if (isJpegSofMarker(marker)) {
      if (segmentLength < 7 || offset + 6 >= bytes.byteLength) {
        return null;
      }
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      return hasValidDimensions(width, height) ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

function validateAvifDimensions(bytes: Uint8Array): { width: number | null; height: number | null } | null {
  if (!isAvifMagic(bytes)) {
    return null;
  }
  const ftypSize = readUint32BE(bytes, 0);
  if (ftypSize !== 0 && ftypSize < 16) {
    return null;
  }
  const scanLimit = Math.min(bytes.byteLength, 64 * 1024);
  for (let offset = 4; offset + 16 <= scanLimit; offset += 1) {
    if (
      bytes[offset] === 0x69 &&
      bytes[offset + 1] === 0x73 &&
      bytes[offset + 2] === 0x70 &&
      bytes[offset + 3] === 0x65
    ) {
      const boxSize = readUint32BE(bytes, offset - 4);
      if (boxSize >= 20) {
        const width = readUint32BE(bytes, offset + 8);
        const height = readUint32BE(bytes, offset + 12);
        return hasValidDimensions(width, height) ? { width, height } : null;
      }
    }
  }
  return { width: null, height: null };
}

export function readRasterImageDimensions(
  bytes: Uint8Array,
): { mimeType: SupportedCoverImageMimeType; width: number | null; height: number | null } | null {
  const png = parsePngDimensions(bytes);
  if (png) {
    return { mimeType: "image/png", ...png };
  }
  const jpeg = parseJpegDimensions(bytes);
  if (jpeg) {
    return { mimeType: "image/jpeg", ...jpeg };
  }
  const gif = parseGifDimensions(bytes);
  if (gif) {
    return { mimeType: "image/gif", ...gif };
  }
  const webp = parseWebpDimensions(bytes);
  if (webp) {
    return { mimeType: "image/webp", ...webp };
  }
  const avif = validateAvifDimensions(bytes);
  if (avif) {
    return { mimeType: "image/avif", ...avif };
  }
  return null;
}

/**
 * Inspect actual leading magic bytes and minimal structural header dimensions
 * to verify PNG, JPEG, WebP, GIF, or AVIF. Untrusted Content-Type headers,
 * truncated/zero-dimension headers, or non-raster payloads are rejected.
 */
export function detectImageMimeType(bytes: Uint8Array): SupportedCoverImageMimeType | null {
  return readRasterImageDimensions(bytes)?.mimeType ?? null;
}

function buildSafeImageEndpointUrl(
  baseUrl: string,
  requestPath: string,
  options?: SsrfGuardOptions & { secrets?: readonly string[] },
): URL {
  const base = validateOutboundUrl(baseUrl, options);
  if (/^[a-z][a-z\d+.-]*:/i.test(requestPath) || requestPath.startsWith("//")) {
    throw new Error("Image model request path is invalid");
  }
  const normalizedBasePath = base.pathname.replace(/\/+$/, "");
  const parsedPath = new URL(requestPath.startsWith("/") ? requestPath : `/${requestPath}`, "https://image.invalid");
  if (parsedPath.origin !== "https://image.invalid" || parsedPath.username || parsedPath.password || parsedPath.hash) {
    throw new Error("Image model request path is invalid");
  }
  const normalizedRequestPath = parsedPath.pathname.replace(/\/+$/, "") || "/";
  const endpointPath = normalizedBasePath.endsWith(normalizedRequestPath)
    ? normalizedBasePath || "/"
    : `${normalizedBasePath}${normalizedRequestPath}` || "/";
  const endpoint = new URL(base.origin);
  endpoint.pathname = endpointPath;
  endpoint.search = parsedPath.search;
  return validateOutboundUrl(endpoint, options);
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

async function imageToBuffer(
  image: { type: "url" | "base64"; value: string },
  runtime: AiCoverImageRuntimeOptions | undefined,
  secrets: readonly string[],
): Promise<{ buffer: Buffer; contentType: SupportedCoverImageMimeType }> {
  if (image.type === "base64") {
    const normalized = image.value.trim().replace(/^data:[^;,]+;base64,/i, "").replace(/\s+/g, "");
    if (normalized.length > MAX_BASE64_CHAR_LENGTH) {
      throw new Error("Generated image is too large");
    }
    const buffer = Buffer.from(normalized, "base64");
    if (buffer.byteLength > IMAGE_RESPONSE_MAX_BYTES) {
      throw new Error("Generated image is too large");
    }
    const contentType = detectImageMimeType(buffer);
    if (!contentType) {
      throw new Error("Generated image payload is not a supported raster image format");
    }
    return { buffer, contentType };
  }

  const response = await safeOutboundFetch(
    image.value,
    {
      method: "GET",
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(60_000),
    },
    {
      fetchImpl: runtime?.fetchImpl,
      allowLoopback: runtime?.allowLoopback,
      secrets,
    },
  );
  if (!response.ok) {
    await cancelResponseBody(response);
    throw new Error(`Generated image download failed with HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await readResponseBytesBounded(response, { maxBytes: IMAGE_RESPONSE_MAX_BYTES, secrets }));
  const contentType = detectImageMimeType(buffer);
  if (!contentType) {
    throw new Error("Generated image payload is not a supported raster image format");
  }

  return {
    buffer,
    contentType,
  };
}

function isDashScopeNativeImageModel(model: AiModelOption) {
  try {
    return new URL(model.baseUrl).hostname.toLowerCase().endsWith("dashscope.aliyuncs.com") && model.requestPath.includes("/services/aigc/image-generation/generation");
  } catch {
    return false;
  }
}

async function pollDashScopeImageTask(
  model: AiModelOption,
  taskId: string,
  runtime: AiCoverImageRuntimeOptions | undefined,
  secrets: readonly string[],
) {
  if (!SAFE_TASK_ID_PATTERN.test(taskId)) {
    throw new Error("Image generation returned an invalid task id");
  }
  const normalizedTaskBase = model.baseUrl.replace(/\/api\/v1\/?$/, "/api/v1");
  const taskEndpoint = buildSafeImageEndpointUrl(normalizedTaskBase, `/tasks/${encodeURIComponent(taskId)}`, {
    allowLoopback: runtime?.allowLoopback,
    secrets,
  });
  const pollIntervalMs = runtime?.pollIntervalMs ?? 5_000;
  const maxAttempts = runtime?.maxPollAttempts ?? 24;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (pollIntervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    const response = await safeOutboundFetch(
      taskEndpoint,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${model.apiKey}` },
        signal: AbortSignal.timeout(30_000),
      },
      {
        fetchImpl: runtime?.fetchImpl,
        allowLoopback: runtime?.allowLoopback,
        secrets,
      },
    );
    const payload = await readImageJson(response, secrets);
    if (!response.ok) {
      throw new Error(
        scrubUpstreamDiagnostic(
          payload.error?.message || payload.output?.message || payload.message || `Image task polling failed with HTTP ${response.status}`,
          { secrets },
        ),
      );
    }

    if (payload.output?.task_status === "SUCCEEDED") {
      const image = parseGeneratedImage(payload);
      if (!image) throw new Error("Image generation returned no image");
      return imageToBuffer(image, runtime, secrets);
    }

    if (payload.output?.task_status === "FAILED" || payload.output?.task_status === "CANCELED") {
      throw new Error(
        scrubUpstreamDiagnostic(
          payload.output.message || payload.message || `Image generation task ${payload.output.task_status.toLowerCase()}`,
          { secrets },
        ),
      );
    }
  }

  throw new Error("Image generation task timed out");
}

async function callDashScopeNativeImageModel(
  model: AiModelOption,
  prompt: string,
  size: AiCoverSize,
  runtime: AiCoverImageRuntimeOptions | undefined,
  secrets: readonly string[],
) {
  const endpoint = buildSafeImageEndpointUrl(model.baseUrl, model.requestPath, {
    allowLoopback: runtime?.allowLoopback,
    secrets,
  });
  const response = await safeOutboundFetch(
    endpoint,
    {
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
    },
    {
      fetchImpl: runtime?.fetchImpl,
      allowLoopback: runtime?.allowLoopback,
      allowCrossOriginRedirects: false,
      secrets,
    },
  );

  const payload = await readImageJson(response, secrets);
  if (!response.ok) {
    throw new Error(
      scrubUpstreamDiagnostic(
        payload.error?.message || payload.output?.message || payload.message || `Image generation failed with HTTP ${response.status}`,
        { secrets },
      ),
    );
  }

  const taskId = payload.output?.task_id;
  if (!taskId) {
    const image = parseGeneratedImage(payload);
    if (!image) throw new Error("Image generation returned no task or image");
    return imageToBuffer(image, runtime, secrets);
  }

  return pollDashScopeImageTask(model, taskId, runtime, secrets);
}

async function callOpenAICompatibleImageModel(
  model: AiModelOption,
  prompt: string,
  size: AiCoverSize,
  runtime: AiCoverImageRuntimeOptions | undefined,
  secrets: readonly string[],
) {
  const endpoint = buildSafeImageEndpointUrl(model.baseUrl, model.requestPath, {
    allowLoopback: runtime?.allowLoopback,
    secrets,
  });
  const response = await safeOutboundFetch(
    endpoint,
    {
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
    },
    {
      fetchImpl: runtime?.fetchImpl,
      allowLoopback: runtime?.allowLoopback,
      allowCrossOriginRedirects: false,
      secrets,
    },
  );

  const payload = await readImageJson(response, secrets);
  if (!response.ok) {
    throw new Error(
      scrubUpstreamDiagnostic(
        payload.error?.message || payload.message || `Image generation failed with HTTP ${response.status}`,
        { secrets },
      ),
    );
  }

  const image = parseGeneratedImage(payload);
  if (!image) {
    throw new Error("Image generation returned no image");
  }

  return imageToBuffer(image, runtime, secrets);
}

async function callImageModel(
  model: AiModelOption,
  prompt: string,
  size: AiCoverSize,
  runtime: AiCoverImageRuntimeOptions | undefined,
) {
  if (!model.apiKey) {
    throw new ValidationError(`${model.apiKeyEnv} is not configured`);
  }

  const secrets = [model.apiKey];
  try {
    return await (isDashScopeNativeImageModel(model)
      ? callDashScopeNativeImageModel(model, prompt, size, runtime, secrets)
      : callOpenAICompatibleImageModel(model, prompt, size, runtime, secrets));
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(scrubUpstreamDiagnostic(error, { secrets }));
  }
}

export async function generateAiCoverImage(
  input: GenerateAiCoverInput,
  runtime?: AiCoverImageRuntimeOptions,
): Promise<CoverAssetRecord> {
  const title = truncate(input.title, 160);
  if (!title) {
    throw new ValidationError("Title is required before generating a cover image");
  }

  const size = input.size ?? "16:9";
  const model = await withAiInfrastructure(() => getAiModelForCapability("cover-image", input.modelId));
  if (!model) {
    throw new ValidationError("No available cover image model is configured");
  }

  const finalPrompt = buildCoverImagePrompt(input);
  const image = await callImageModel(model, finalPrompt, size, runtime);
  const uploaded = await withAiInfrastructure(() => uploadBufferToQiniu({ buffer: image.buffer, contentType: image.contentType, keyPrefix: "covers/ai" }));

  return withAiInfrastructure(() => createCoverAsset({
    url: uploaded.url,
    key: uploaded.key,
    provider: "qiniu",
    source: "ai",
    generatedByAi: true,
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
  }));
}
