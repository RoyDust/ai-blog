import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { ValidationError } from "@/lib/api-errors";

export const ENCRYPTED_API_KEY_PREFIX = "enc:v1:";

/**
 * AI_MODEL_SECRET_KEY is the intended stable key source for stored model API keys.
 * AUTH_SECRET/NEXTAUTH_SECRET remain legacy fallbacks; rotating either auth secret
 * without first migrating AI_MODEL_SECRET_KEY will make existing encrypted keys
 * undecryptable.
 */
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

export function encryptApiKeyForStorage(apiKey: string | null | undefined) {
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

export function decryptApiKeyFromStorage(apiKey: string | null) {
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
