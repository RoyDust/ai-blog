import { afterEach, describe, expect, test, vi } from "vitest";

import { ApiRequestError } from "@/lib/client-api";
import { normalizeUploadFileMeta, uploadFileToQiniu } from "../client-qiniu-upload";

describe("client-qiniu-upload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("aligns filename extension with MIME type and strips unsafe path segments", () => {
    const webpBlob = new Blob(["webp"], { type: "image/webp" });
    expect(normalizeUploadFileMeta(webpBlob, { fileName: "avatar", purpose: "avatar" })).toEqual({
      filename: "avatar.webp",
      contentType: "image/webp",
    });

    const mismatchedFile = new File(["png"], "../nested/photo.jpg", { type: "image/png" });
    expect(normalizeUploadFileMeta(mismatchedFile)).toEqual({
      filename: "photo.png",
      contentType: "image/png",
    });

    const aliasJpgFile = new File(["jpg"], "banner.jpeg", { type: "image/jpg" });
    expect(normalizeUploadFileMeta(aliasJpgFile)).toEqual({
      filename: "banner.jpeg",
      contentType: "image/jpeg",
    });
  });

  test("requests token via apiMutate, uploads FormData directly, and normalizes domain URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            token: "qiniu-token-1",
            key: "covers/123-demo.png",
            domain: "https://cdn.example.com/",
            uploadUrl: "https://upload.qiniup.com",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ key: "covers/123-demo.png" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["image-bytes"], "demo.png", { type: "image/png" });
    const result = await uploadFileToQiniu(file, { purpose: "cover" });

    expect(result).toEqual({
      key: "covers/123-demo.png",
      url: "https://cdn.example.com/covers/123-demo.png",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/uploads/qiniu-token");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      filename: "demo.png",
      contentType: "image/png",
      purpose: "cover",
    });

    const formData = fetchMock.mock.calls[1][1]?.body as FormData;
    expect(fetchMock.mock.calls[1][0]).toBe("https://upload.qiniup.com");
    expect(formData.get("file")).toBe(file);
    expect(formData.get("token")).toBe("qiniu-token-1");
    expect(formData.get("key")).toBe("covers/123-demo.png");
  });

  test("rewraps File/Blob with normalized contentType when file.type is alias or empty so multipart MIME matches Qiniu single mimeLimit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            token: "qiniu-token-jpeg",
            key: "covers/123-banner.jpeg",
            domain: "https://cdn.example.com",
            uploadUrl: "https://upload.qiniup.com",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ key: "covers/123-banner.jpeg" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            token: "qiniu-token-png",
            key: "covers/123-empty-type.png",
            domain: "https://cdn.example.com",
            uploadUrl: "https://upload.qiniup.com",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ key: "covers/123-empty-type.png" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    // 1) image/jpg -> image/jpeg normalization
    const aliasJpgFile = new File(["jpg-bytes"], "banner.jpeg", { type: "image/jpg" });
    await uploadFileToQiniu(aliasJpgFile);
    const jpgFormData = fetchMock.mock.calls[1][1]?.body as FormData;
    const uploadedJpgPart = jpgFormData.get("file") as File;
    expect(uploadedJpgPart).toBeInstanceOf(Blob);
    expect(uploadedJpgPart.type).toBe("image/jpeg");
    expect(uploadedJpgPart.name).toBe("banner.jpeg");

    // 2) empty file.type -> extension-inferred image/png normalization
    const emptyTypeFile = new File(["png-bytes"], "empty-type.png", { type: "" });
    await uploadFileToQiniu(emptyTypeFile);
    const pngFormData = fetchMock.mock.calls[3][1]?.body as FormData;
    const uploadedPngPart = pngFormData.get("file") as File;
    expect(uploadedPngPart).toBeInstanceOf(Blob);
    expect(uploadedPngPart.type).toBe("image/png");
    expect(uploadedPngPart.name).toBe("empty-type.png");
  });

  test("normalizes API, configuration, validation, and network errors into Chinese", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      }),
    );
    const file = new File(["x"], "demo.png", { type: "image/png" });
    await expect(uploadFileToQiniu(file)).rejects.toMatchObject({
      message: "登录状态已失效，请重新登录",
      status: 401,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Missing Qiniu config" }),
      }),
    );
    const configErr = await uploadFileToQiniu(file).catch((err: unknown) => err);
    expect(configErr).toBeInstanceOf(ApiRequestError);
    expect((configErr as Error).message).toBe("图床未配置，请联系管理员");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")));
    await expect(uploadFileToQiniu(file)).rejects.toThrow("网络异常，请检查网络连接后重试");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              token: "t",
              key: "covers/1.png",
              domain: "https://cdn.example.com",
              uploadUrl: "https://upload.qiniup.com",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 413,
          json: async () => ({}),
        }),
    );
    await expect(uploadFileToQiniu(file)).rejects.toThrow("图片体积超出限制（最大 10MB）");
  });
});
