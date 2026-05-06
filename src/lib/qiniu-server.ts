import crypto from "node:crypto";

import { ValidationError } from "@/lib/api-errors";

const defaultUploadUrl = "https://upload.qiniup.com";

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createUploadToken(bucket: string, key: string, accessKey: string, secretKey: string) {
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const putPolicy = {
    scope: `${bucket}:${key}`,
    deadline,
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize)}',
  };

  const encodedPolicy = encodeBase64Url(JSON.stringify(putPolicy));
  const digest = crypto.createHmac("sha1", secretKey).update(encodedPolicy).digest();
  const encodedDigest = encodeBase64Url(digest);

  return `${accessKey}:${encodedDigest}:${encodedPolicy}`;
}

function normalizeDomain(domain: string) {
  return domain.replace(/\/+$/, "");
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export async function uploadBufferToQiniu(input: {
  buffer: Buffer;
  contentType: string;
  keyPrefix?: string;
}) {
  const accessKey = process.env.QINIU_ACCESS_KEY;
  const secretKey = process.env.QINIU_SECRET_KEY;
  const bucket = process.env.QINIU_BUCKET;
  const domain = process.env.QINIU_DOMAIN;
  const uploadUrl = process.env.QINIU_UPLOAD_URL || defaultUploadUrl;

  if (!accessKey || !secretKey || !bucket || !domain) {
    throw new ValidationError("Missing Qiniu config");
  }

  const ext = extensionFromContentType(input.contentType);
  const key = `${input.keyPrefix ?? "covers/ai"}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const token = createUploadToken(bucket, key, accessKey, secretKey);
  const form = new FormData();
  form.set("token", token);
  form.set("key", key);
  const fileBuffer = input.buffer.buffer.slice(input.buffer.byteOffset, input.buffer.byteOffset + input.buffer.byteLength) as ArrayBuffer;
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
