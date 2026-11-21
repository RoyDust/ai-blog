import crypto from "node:crypto";

import { ValidationError } from "@/lib/api-errors";
import {
  ALLOWED_UPLOAD_IMAGE_MIMES,
  parseUploadFilename,
  type UploadPurpose,
} from "@/lib/validation";

export const DEFAULT_QINIU_UPLOAD_URL = "https://upload.qiniup.com";
export const QINIU_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const QINIU_UPLOAD_MIME_LIMIT = ALLOWED_UPLOAD_IMAGE_MIMES.join(";");

/**
 * 七牛上传凭证要求使用 URL-safe base64。
 */
function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * 校验文件名并生成安全的对象存储 key（强制栅格图片后缀白名单与防路径穿越）。
 */
export function buildUploadKey(filename: string, purpose: UploadPurpose = "cover") {
  const { stem, ext } = parseUploadFilename(filename);
  const folder = purpose === "avatar" ? "avatars" : "covers";
  const base =
    stem
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || purpose;
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");
  return `${folder}/${timestamp}-${random}-${base}${ext}`;
}

/**
 * 按七牛直传协议生成单文件上传 token（限制 10 MiB 体积与栅格图片 MIME 白名单）。
 */
export function createQiniuUploadToken(input: {
  bucket: string;
  key: string;
  accessKey: string;
  secretKey: string;
  expiresInSeconds?: number;
}) {
  const deadline = Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? 3600);
  const putPolicy = {
    scope: `${input.bucket}:${input.key}`,
    deadline,
    fsizeLimit: QINIU_UPLOAD_MAX_FILE_SIZE_BYTES,
    mimeLimit: QINIU_UPLOAD_MIME_LIMIT,
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize)}',
  };

  const encodedPolicy = encodeBase64Url(JSON.stringify(putPolicy));
  const digest = crypto.createHmac("sha1", input.secretKey).update(encodedPolicy).digest();
  const encodedDigest = encodeBase64Url(digest);

  return `${input.accessKey}:${encodedDigest}:${encodedPolicy}`;
}

/**
 * 统一去掉配置域名末尾斜杠，避免拼接 URL 时出现双斜杠。
 */
function normalizeDomain(domain: string) {
  return domain.replace(/\/+$/, "");
}

/**
 * 根据图片 MIME 类型推导对象存储 key 的扩展名。
 */
export function extensionFromContentType(contentType: string) {
  const normalized = contentType.trim().toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("avif")) return "avif";
  return "jpg";
}

/**
 * 服务端上传图片 Buffer 到七牛。
 *
 * 主要供 AI 生图结果使用；浏览器端本地上传仍走 token 直传，避免图片数据经过应用服务器。
 */
export async function uploadBufferToQiniu(input: {
  buffer: Buffer;
  contentType: string;
  keyPrefix?: string;
}) {
  const accessKey = process.env.QINIU_ACCESS_KEY;
  const secretKey = process.env.QINIU_SECRET_KEY;
  const bucket = process.env.QINIU_BUCKET;
  const domain = process.env.QINIU_DOMAIN;
  const uploadUrl = process.env.QINIU_UPLOAD_URL || DEFAULT_QINIU_UPLOAD_URL;

  if (!accessKey || !secretKey || !bucket || !domain) {
    throw new ValidationError("Missing Qiniu config");
  }

  const ext = extensionFromContentType(input.contentType);
  const key = `${input.keyPrefix ?? "covers/ai"}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const token = createQiniuUploadToken({ bucket, key, accessKey, secretKey });
  const form = new FormData();
  form.set("token", token);
  form.set("key", key);
  const fileBuffer = input.buffer.buffer.slice(
    input.buffer.byteOffset,
    input.buffer.byteOffset + input.buffer.byteLength,
  ) as ArrayBuffer;
  form.set("file", new Blob([fileBuffer], { type: input.contentType }), `cover.${ext}`);

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Qiniu upload failed with HTTP ${response.status}`);
  }

  return {
    key,
    url: `${normalizeDomain(domain)}/${key}`,
  };
}
