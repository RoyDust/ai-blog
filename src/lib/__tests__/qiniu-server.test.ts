import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ValidationError } from "../api-errors";
import {
  buildUploadKey,
  createQiniuUploadToken,
  extensionFromContentType,
  mimeTypeFromUploadKey,
  uploadBufferToQiniu,
} from "../qiniu-server";

function decodePutPolicy(token: string) {
  const parts = token.split(":");
  expect(parts).toHaveLength(3);
  const [, encodedSign, encodedPolicy] = parts;
  const json = Buffer.from(encodedPolicy.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return {
    accessKey: parts[0],
    encodedSign,
    encodedPolicy,
    policy: JSON.parse(json) as Record<string, unknown>,
  };
}

describe("qiniu-server", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.QINIU_ACCESS_KEY = "ak-test";
    process.env.QINIU_SECRET_KEY = "sk-test";
    process.env.QINIU_BUCKET = "inkforge-bucket";
    process.env.QINIU_DOMAIN = "https://cdn.example.com/";
    delete process.env.QINIU_UPLOAD_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  test("maps raster image MIME types to file extensions", () => {
    expect(extensionFromContentType("image/png")).toBe("png");
    expect(extensionFromContentType("image/webp")).toBe("webp");
    expect(extensionFromContentType("image/gif")).toBe("gif");
    expect(extensionFromContentType("image/avif")).toBe("avif");
    expect(extensionFromContentType("image/jpeg")).toBe("jpg");
    expect(extensionFromContentType("IMAGE/AVIF")).toBe("avif");
  });

  test("builds sanitized upload keys and rejects unsafe extensions or traversal", () => {
    expect(buildUploadKey("My Hero Image.JPEG", "cover")).toMatch(
      /^covers\/\d+-[a-f0-9]{8}-my-hero-image\.jpeg$/,
    );
    expect(buildUploadKey("封面图.PNG", "avatar")).toMatch(
      /^avatars\/\d+-[a-f0-9]{8}-avatar\.png$/,
    );

    for (const unsafe of [
      "xss.svg",
      "page.html",
      "bundle.js",
      "noext",
      "../cover.png",
      "a.b/../../x.png",
      "sub/cover.png",
      "sub\\cover.png",
      "bad\0name.png",
    ]) {
      expect(() => buildUploadKey(unsafe, "cover")).toThrow(ValidationError);
    }
  });

  test("signs Qiniu upload token with fsizeLimit (10 MiB) and single extension-bound mimeLimit", () => {
    const extensionCases = [
      { key: "covers/test.webp", expectedMime: "image/webp" },
      { key: "covers/test.png", expectedMime: "image/png" },
      { key: "covers/test.gif", expectedMime: "image/gif" },
      { key: "covers/test.avif", expectedMime: "image/avif" },
      { key: "covers/test.jpg", expectedMime: "image/jpeg" },
      { key: "covers/test.jpeg", expectedMime: "image/jpeg" },
    ] as const;

    for (const item of extensionCases) {
      expect(mimeTypeFromUploadKey(item.key)).toBe(item.expectedMime);
      const token = createQiniuUploadToken({
        bucket: "inkforge-bucket",
        key: item.key,
        accessKey: "ak-test",
        secretKey: "sk-test",
      });

      const { accessKey, encodedSign, encodedPolicy, policy } = decodePutPolicy(token);
      const expectedSign = crypto
        .createHmac("sha1", "sk-test")
        .update(encodedPolicy)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

      expect(accessKey).toBe("ak-test");
      expect(encodedSign).toBe(expectedSign);
      expect(policy).toMatchObject({
        scope: `inkforge-bucket:${item.key}`,
        fsizeLimit: 10 * 1024 * 1024,
        mimeLimit: item.expectedMime,
        returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize)}',
      });
      expect(typeof policy.deadline).toBe("number");
    }

    expect(() =>
      createQiniuUploadToken({
        bucket: "inkforge-bucket",
        key: "covers/test.png",
        accessKey: "ak-test",
        secretKey: "sk-test",
        mimeType: "image/webp",
      }),
    ).toThrow(ValidationError);

    expect(() =>
      createQiniuUploadToken({
        bucket: "inkforge-bucket",
        key: "covers/xss.svg",
        accessKey: "ak-test",
        secretKey: "sk-test",
      }),
    ).toThrow(ValidationError);
  });

  test("uploads buffer to Qiniu using mapped extension and single-MIME upload policy", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadBufferToQiniu({
      buffer: Buffer.from("avif-bytes"),
      contentType: "image/avif",
      keyPrefix: "covers/ai",
    });

    expect(result.key).toMatch(/^covers\/ai\/\d+-[a-f0-9]{12}\.avif$/);
    expect(result.url).toBe(`https://cdn.example.com/${result.key}`);

    const formData = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const token = String(formData.get("token"));
    const { policy } = decodePutPolicy(token);
    expect(policy.fsizeLimit).toBe(10 * 1024 * 1024);
    expect(policy.mimeLimit).toBe("image/avif");
  });

  test("throws ValidationError when Qiniu environment configuration is incomplete", async () => {
    delete process.env.QINIU_BUCKET;

    await expect(
      uploadBufferToQiniu({
        buffer: Buffer.from("png-bytes"),
        contentType: "image/png",
      }),
    ).rejects.toThrow(ValidationError);
  });
});
