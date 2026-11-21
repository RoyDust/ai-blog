import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getAiModelForCapability = vi.fn();
const uploadBufferToQiniu = vi.fn();
const createCoverAsset = vi.fn();

vi.mock("@/lib/ai-models", () => ({
  getAiModelForCapability,
}));

vi.mock("@/lib/qiniu-server", () => ({
  uploadBufferToQiniu,
}));

vi.mock("@/lib/cover-assets", () => ({
  createCoverAsset,
}));

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const WEBP_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x24, 0x00, 0x00, 0x00, // size
  0x57, 0x45, 0x42, 0x50, // WEBP
  0x56, 0x50, 0x38, 0x20, // VP8
]);
const GIF_BYTES = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00", "binary");
const AVIF_MAJOR_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x1c, // size = 28
  0x66, 0x74, 0x79, 0x70, // ftyp
  0x61, 0x76, 0x69, 0x66, // avif
  0x00, 0x00, 0x00, 0x00, // minor_version
  0x6d, 0x69, 0x66, 0x31, // mif1
  0x6d, 0x69, 0x61, 0x66, // miaf
  0x61, 0x76, 0x69, 0x66, // avif
]);
const AVIF_COMPAT_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18, // size = 24
  0x66, 0x74, 0x79, 0x70, // ftyp
  0x6d, 0x69, 0x66, 0x31, // major = mif1
  0x00, 0x00, 0x00, 0x00, // minor_version
  0x6d, 0x69, 0x61, 0x66, // miaf
  0x61, 0x76, 0x69, 0x66, // compatible = avif
]);

describe("ai cover image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiModelForCapability.mockResolvedValue({
      id: "qwen-wan2.6-image",
      name: "千问 Wan 2.6 生图",
      baseUrl: "https://dashscope.example/v1",
      requestPath: "/images/generations",
      model: "wan2.6-image",
      apiKey: "sk-cover-secret-key",
      apiKeyEnv: "AI_IMAGE_DASHSCOPE_API_KEY",
    });
    uploadBufferToQiniu.mockResolvedValue({ key: "covers/ai/a.png", url: "https://cdn.example.com/covers/ai/a.png" });
    createCoverAsset.mockResolvedValue({ id: "cover-1", url: "https://cdn.example.com/covers/ai/a.png" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: PNG_BYTES.toString("base64") }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("generates image, uploads it, and creates cover asset", async () => {
    const { generateAiCoverImage } = await import("../ai-cover-image");
    const result = await generateAiCoverImage({ title: "AI News", excerpt: "Daily update", prompt: "dark", createdById: "admin-1" });

    expect(result).toEqual({ id: "cover-1", url: "https://cdn.example.com/covers/ai/a.png" });
    expect(getAiModelForCapability).toHaveBeenCalledWith("cover-image", undefined);
    expect(fetch).toHaveBeenCalledWith("https://dashscope.example/v1/images/generations", expect.objectContaining({ method: "POST", redirect: "manual" }));
    expect(uploadBufferToQiniu).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/png", keyPrefix: "covers/ai" }));
    expect(createCoverAsset).toHaveBeenCalledWith(expect.objectContaining({
      provider: "qiniu",
      source: "ai",
      generatedByAi: true,
      aiModelId: "qwen-wan2.6-image",
      createdById: "admin-1",
    }));
  });

  test("classifies upload outages as infrastructure failures before asset persistence", async () => {
    const failure = new Error("Qiniu unavailable");
    uploadBufferToQiniu.mockRejectedValueOnce(failure);
    const { generateAiCoverImage } = await import("../ai-cover-image");
    await expect(generateAiCoverImage({ title: "AI News", createdById: "admin-1" })).rejects.toMatchObject({ name: "AiInfrastructureError", cause: failure });
    expect(createCoverAsset).not.toHaveBeenCalled();
  });

  test("detects real magic bytes for PNG, JPEG, WebP, GIF, and AVIF across both URL and Base64 payloads", async () => {
    const { generateAiCoverImage } = await import("../ai-cover-image");

    const cases = [
      { label: "png", bytes: PNG_BYTES, expectedMime: "image/png" },
      { label: "jpeg", bytes: JPEG_BYTES, expectedMime: "image/jpeg" },
      { label: "webp", bytes: WEBP_BYTES, expectedMime: "image/webp" },
      { label: "gif", bytes: GIF_BYTES, expectedMime: "image/gif" },
      { label: "avif-major", bytes: AVIF_MAJOR_BYTES, expectedMime: "image/avif" },
      { label: "avif-compat", bytes: AVIF_COMPAT_BYTES, expectedMime: "image/avif" },
    ] as const;

    for (const item of cases) {
      // 1) Base64 branch
      uploadBufferToQiniu.mockClear();
      const base64Fetch = vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify({ data: [{ b64_json: item.bytes.toString("base64") }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await generateAiCoverImage({ title: `Base64 ${item.label}`, createdById: "admin-1" }, { fetchImpl: base64Fetch });
      expect(uploadBufferToQiniu).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: item.expectedMime, buffer: item.bytes }),
      );

      // 2) URL branch (with intentionally misleading upstream Content-Type header)
      uploadBufferToQiniu.mockClear();
      const urlFetch = vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url === "https://dashscope.example/v1/images/generations") {
          return new Response(JSON.stringify({ data: [{ url: `https://images.example.com/generated.${item.label}` }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(item.bytes, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        });
      });
      await generateAiCoverImage({ title: `URL ${item.label}`, createdById: "admin-1" }, { fetchImpl: urlFetch });
      expect(uploadBufferToQiniu).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: item.expectedMime, buffer: item.bytes }),
      );
    }
  });

  test("rejects text/plain, HTML, SVG, JSON, and unknown binary payloads for both URL and Base64 before Qiniu upload", async () => {
    const { generateAiCoverImage } = await import("../ai-cover-image");

    const invalidPayloads = [
      Buffer.from("plain text secret content", "utf8"),
      Buffer.from("<!DOCTYPE html><html><body>metadata</body></html>", "utf8"),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "utf8"),
      Buffer.from('{"accessKeyId":"STS.secret"}', "utf8"),
      Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]),
    ];

    for (const payload of invalidPayloads) {
      // Base64 rejection
      const base64Fetch = vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify({ data: [{ b64_json: payload.toString("base64") }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await expect(
        generateAiCoverImage({ title: "Bad Base64", createdById: "admin-1" }, { fetchImpl: base64Fetch }),
      ).rejects.toThrow(/supported raster image|image format/i);
      expect(uploadBufferToQiniu).not.toHaveBeenCalled();

      // URL rejection (even if upstream lies with Content-Type: image/png)
      const urlFetch = vi.fn<typeof fetch>(async (input) => {
        if (String(input).endsWith("/images/generations")) {
          return new Response(JSON.stringify({ data: [{ url: "https://images.example.com/fake.png" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(payload, { status: 200, headers: { "Content-Type": "image/png" } });
      });
      await expect(
        generateAiCoverImage({ title: "Bad URL", createdById: "admin-1" }, { fetchImpl: urlFetch }),
      ).rejects.toThrow(/supported raster image|image format/i);
      expect(uploadBufferToQiniu).not.toHaveBeenCalled();
    }
  });

  test("blocks direct and 302-redirected SSRF across OpenAI submit, DashScope submit, DashScope polling, and image URL download", async () => {
    const { generateAiCoverImage } = await import("../ai-cover-image");
    const ssrfTargets = [
      "http://127.0.0.1:8080/secret",
      "http://169.254.169.254/latest/meta-data/",
      "http://100.100.100.200/latest/meta-data/",
      "http://[::1]:8080/secret",
    ];

    for (const target of ssrfTargets) {
      // 1) OpenAI-compatible submit direct & 302 redirect
      getAiModelForCapability.mockResolvedValueOnce({
        id: "compat-img",
        name: "Compat Image",
        baseUrl: target,
        requestPath: "/images/generations",
        model: "gpt-image",
        apiKey: "sk-cover-secret-key",
        apiKeyEnv: "database",
      });
      const compatDirectFetch = vi.fn<typeof fetch>();
      await expect(
        generateAiCoverImage({ title: "SSRF 1", createdById: "admin-1" }, { fetchImpl: compatDirectFetch }),
      ).rejects.toThrow();
      expect(compatDirectFetch).not.toHaveBeenCalled();

      getAiModelForCapability.mockResolvedValueOnce({
        id: "compat-img",
        name: "Compat Image",
        baseUrl: "https://dashscope.example/v1",
        requestPath: "/images/generations",
        model: "gpt-image",
        apiKey: "sk-cover-secret-key",
        apiKeyEnv: "database",
      });
      const compatRedirectFetch = vi.fn<typeof fetch>(async () =>
        new Response(null, { status: 302, headers: { location: target } }),
      );
      await expect(
        generateAiCoverImage({ title: "SSRF 1b", createdById: "admin-1" }, { fetchImpl: compatRedirectFetch }),
      ).rejects.toThrow();
      expect(compatRedirectFetch).toHaveBeenCalledTimes(1);

      // 2) DashScope native submit + 3) DashScope task polling 302 redirect
      getAiModelForCapability.mockResolvedValueOnce({
        id: "dashscope-native",
        name: "DashScope Native",
        baseUrl: "https://dashscope.aliyuncs.com/api/v1",
        requestPath: "/services/aigc/image-generation/generation",
        model: "wan2.6-t2i",
        apiKey: "sk-cover-secret-key",
        apiKeyEnv: "DASHSCOPE_API_KEY",
      });
      const pollRedirectFetch = vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.includes("/services/aigc/image-generation/generation")) {
          return new Response(JSON.stringify({ output: { task_id: "task_123" } }), { status: 200 });
        }
        return new Response(null, { status: 302, headers: { location: target } });
      });
      await expect(
        generateAiCoverImage(
          { title: "SSRF Poll", createdById: "admin-1" },
          { fetchImpl: pollRedirectFetch, pollIntervalMs: 0 },
        ),
      ).rejects.toThrow();
      expect(pollRedirectFetch).toHaveBeenCalledTimes(2);

      // 4) Returned image URL direct & 302 redirect
      getAiModelForCapability.mockResolvedValueOnce({
        id: "compat-img",
        name: "Compat Image",
        baseUrl: "https://dashscope.example/v1",
        requestPath: "/images/generations",
        model: "gpt-image",
        apiKey: "sk-cover-secret-key",
        apiKeyEnv: "database",
      });
      const imageDirectSsrfFetch = vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify({ data: [{ url: target }] }), { status: 200 }),
      );
      await expect(
        generateAiCoverImage({ title: "SSRF Image Direct", createdById: "admin-1" }, { fetchImpl: imageDirectSsrfFetch }),
      ).rejects.toThrow();
      expect(imageDirectSsrfFetch).toHaveBeenCalledTimes(1);

      getAiModelForCapability.mockResolvedValueOnce({
        id: "compat-img",
        name: "Compat Image",
        baseUrl: "https://dashscope.example/v1",
        requestPath: "/images/generations",
        model: "gpt-image",
        apiKey: "sk-cover-secret-key",
        apiKeyEnv: "database",
      });
      const imageRedirectSsrfFetch = vi.fn<typeof fetch>(async (input) => {
        if (String(input).endsWith("/images/generations")) {
          return new Response(JSON.stringify({ data: [{ url: "https://images.example.com/hop" }] }), { status: 200 });
        }
        return new Response(null, { status: 302, headers: { location: target } });
      });
      await expect(
        generateAiCoverImage({ title: "SSRF Image Redirect", createdById: "admin-1" }, { fetchImpl: imageRedirectSsrfFetch }),
      ).rejects.toThrow();
      expect(imageRedirectSsrfFetch).toHaveBeenCalledTimes(2);
      expect(uploadBufferToQiniu).not.toHaveBeenCalled();
    }
  });

  test("scrubs echoed model API keys from upstream image generation and polling errors", async () => {
    const { generateAiCoverImage } = await import("../ai-cover-image");

    const leakFetch = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({ error: { message: "Invalid key sk-cover-secret-key for Bearer sk-cover-secret-key" } }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    const error = await generateAiCoverImage(
      { title: "Secret Scrub", createdById: "admin-1" },
      { fetchImpl: leakFetch },
    ).then(
      () => {
        throw new Error("Expected generateAiCoverImage to reject");
      },
      (e: unknown) => e as Error,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain("sk-cover-secret-key");
    expect(error.message).toContain("[redacted]");
  });
});
