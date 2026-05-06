import { beforeEach, describe, expect, test, vi } from "vitest";

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

describe("ai cover image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiModelForCapability.mockResolvedValue({
      id: "qwen-wan2.6-image",
      name: "千问 Wan 2.6 生图",
      baseUrl: "https://dashscope.example/v1",
      requestPath: "/images/generations",
      model: "wan2.6-image",
      apiKey: "key",
      apiKeyEnv: "AI_IMAGE_DASHSCOPE_API_KEY",
    });
    uploadBufferToQiniu.mockResolvedValue({ key: "covers/ai/a.png", url: "https://cdn.example.com/covers/ai/a.png" });
    createCoverAsset.mockResolvedValue({ id: "cover-1", url: "https://cdn.example.com/covers/ai/a.png" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("image").toString("base64") }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  test("generates image, uploads it, and creates cover asset", async () => {
    const { generateAiCoverImage } = await import("../ai-cover-image");
    const result = await generateAiCoverImage({ title: "AI News", excerpt: "Daily update", prompt: "dark", createdById: "admin-1" });

    expect(result).toEqual({ id: "cover-1", url: "https://cdn.example.com/covers/ai/a.png" });
    expect(getAiModelForCapability).toHaveBeenCalledWith("cover-image", undefined);
    expect(fetch).toHaveBeenCalledWith("https://dashscope.example/v1/images/generations", expect.objectContaining({ method: "POST" }));
    expect(uploadBufferToQiniu).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/png", keyPrefix: "covers/ai" }));
    expect(createCoverAsset).toHaveBeenCalledWith(expect.objectContaining({
      provider: "qiniu",
      source: "ai",
      aiModelId: "qwen-wan2.6-image",
      createdById: "admin-1",
    }));
  });
});
