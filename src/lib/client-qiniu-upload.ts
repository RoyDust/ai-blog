import { ApiRequestError, apiMutate, toErrorMessage } from "@/lib/client-api";

export type QiniuClientUploadPurpose = "cover" | "avatar";

export interface QiniuClientUploadOptions {
  fileName?: string;
  contentType?: string;
  purpose?: QiniuClientUploadPurpose;
}

export interface QiniuClientUploadResult {
  url: string;
  key: string;
}

type QiniuUploadTokenPayload = {
  token: string;
  key: string;
  domain: string;
  uploadUrl: string;
};

const MIME_TO_CANONICAL_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  "Missing Qiniu config": "图床未配置，请联系管理员",
  "Invalid filename": "图片文件名无效，请重命名后重试",
  "Invalid purpose": "上传用途参数无效",
  "Unsupported file extension": "不支持的图片格式，请上传 JPG、PNG、WebP、AVIF 或 GIF 图片",
  "Unsupported contentType": "不支持的图片格式，请上传 JPG、PNG、WebP、AVIF 或 GIF 图片",
  "contentType does not match file extension": "图片格式与文件后缀不匹配，请重新选择图片",
};

const MAX_UPLOAD_FILENAME_LENGTH = 255;

function normalizeMimeType(rawMime: string): string {
  const lowered = rawMime.trim().toLowerCase();
  return lowered === "image/jpg" ? "image/jpeg" : lowered;
}

function sanitizeBaseStem(rawStem: string, fallback: string): string {
  const cleaned = rawStem
    .replace(/\0/g, "")
    .replace(/\.{2,}/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .trim();

  return cleaned || fallback;
}

/**
 * 归一化上传文件名与 MIME，使其严格满足 `/api/admin/uploads/qiniu-token` 的后缀与 `contentType` 对齐契约。
 */
export function normalizeUploadFileMeta(
  file: File | Blob,
  options: QiniuClientUploadOptions = {},
): { filename: string; contentType?: string } {
  const fallbackStem = options.purpose === "avatar" ? "avatar" : "image";
  const rawName = (options.fileName ?? (file instanceof File ? file.name : ""))
    .replace(/\0/g, "")
    .split(/[\\/]/)
    .pop()
    ?.trim() ?? "";

  const normalizedMime = normalizeMimeType(options.contentType ?? file.type ?? "");
  const extIndex = rawName.lastIndexOf(".");
  const rawStem = extIndex > 0 ? rawName.slice(0, extIndex) : rawName.replace(/^\.+/, "");
  const rawExt = extIndex > 0 ? rawName.slice(extIndex).toLowerCase() : "";

  const canonicalExtForMime = MIME_TO_CANONICAL_EXT[normalizedMime];
  if (canonicalExtForMime) {
    const extMatchesMime = EXT_TO_MIME[rawExt] === normalizedMime;
    if (
      extMatchesMime &&
      extIndex > 0 &&
      !rawName.includes("..") &&
      rawName.length <= MAX_UPLOAD_FILENAME_LENGTH
    ) {
      return { filename: rawName, contentType: normalizedMime };
    }

    const targetExt = extMatchesMime ? rawExt : canonicalExtForMime;
    const stem = sanitizeBaseStem(rawStem, fallbackStem).slice(
      0,
      MAX_UPLOAD_FILENAME_LENGTH - targetExt.length,
    );
    return { filename: `${stem}${targetExt}`, contentType: normalizedMime };
  }

  const inferredMime = EXT_TO_MIME[rawExt];
  if (inferredMime && !normalizedMime) {
    const stem = sanitizeBaseStem(rawStem, fallbackStem).slice(
      0,
      MAX_UPLOAD_FILENAME_LENGTH - rawExt.length,
    );
    return { filename: `${stem}${rawExt}`, contentType: inferredMime };
  }

  const fallbackFilename = rawName || `${fallbackStem}.webp`;
  return {
    filename: fallbackFilename.slice(0, MAX_UPLOAD_FILENAME_LENGTH),
    ...(normalizedMime ? { contentType: normalizedMime } : {}),
  };
}

function toUploadChineseError(error: unknown, fallback: string): Error {
  if (error instanceof TypeError) {
    return new Error(toErrorMessage(error, fallback));
  }

  if (error instanceof Error) {
    const mapped = UPLOAD_ERROR_MESSAGES[error.message.trim()] ?? toErrorMessage(error, fallback);
    if (error instanceof ApiRequestError) {
      return new ApiRequestError(mapped, error.status);
    }
    return new Error(mapped);
  }

  return new Error(fallback);
}

/**
 * 客户端统一七牛直传入口：
 * 1. 通过 `apiMutate` 申请上传凭证（自动对齐文件名后缀与 `contentType`）
 * 2. 使用 `FormData` 直传对象存储
 * 3. 将网关/网络/凭证异常统一收敛为中文错误提示
 */
export async function uploadFileToQiniu(
  file: File | Blob,
  options: QiniuClientUploadOptions = {},
): Promise<QiniuClientUploadResult> {
  const { filename, contentType } = normalizeUploadFileMeta(file, options);

  let tokenPayload: QiniuUploadTokenPayload;
  try {
    const response = await apiMutate<{
      success?: boolean;
      data?: Partial<QiniuUploadTokenPayload>;
    }>("/api/admin/uploads/qiniu-token", {
      method: "POST",
      body: JSON.stringify({
        filename,
        ...(contentType ? { contentType } : {}),
        ...(options.purpose ? { purpose: options.purpose } : {}),
      }),
    });

    const data = response.data;
    if (!data?.token || !data.key || !data.domain || !data.uploadUrl) {
      throw new Error("获取上传凭证失败");
    }
    tokenPayload = {
      token: data.token,
      key: data.key,
      domain: data.domain,
      uploadUrl: data.uploadUrl,
    };
  } catch (error) {
    throw toUploadChineseError(error, "获取上传凭证失败");
  }

  const formData = new FormData();
  const normalizedBlob =
    contentType && file.type !== contentType
      ? new Blob([file], { type: contentType })
      : file;
  if (normalizedBlob === file && file instanceof File && file.name === filename) {
    formData.append("file", file);
  } else {
    formData.append("file", normalizedBlob, filename);
  }
  formData.append("token", tokenPayload.token);
  formData.append("key", tokenPayload.key);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(tokenPayload.uploadUrl, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw toUploadChineseError(error, "上传到七牛失败");
  }

  if (!uploadResponse.ok) {
    if (uploadResponse.status === 413) {
      throw new Error("图片体积超出限制（最大 10MB）");
    }
    throw new Error("上传到七牛失败");
  }

  const normalizedDomain = String(tokenPayload.domain).replace(/\/+$/, "");
  return {
    key: tokenPayload.key,
    url: `${normalizedDomain}/${tokenPayload.key}`,
  };
}
