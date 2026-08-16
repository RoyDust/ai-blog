import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ApiRequestError,
  apiFetcher,
  apiMutate,
  parseApiResponse,
  toErrorMessage,
} from "../client-api";

const okResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseApiResponse", () => {
  test("2xx 且无 business failure 时返回解析后的数据", async () => {
    const data = await parseApiResponse<{ data: string }>(okResponse({ success: true, data: "ok" }));

    expect(data).toEqual({ success: true, data: "ok" });
  });

  test("HTTP 非 2xx 抛 ApiRequestError 并透出 error 字段", async () => {
    const response = okResponse({ error: "Post not found" }, 404);

    await expect(parseApiResponse(response)).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Post not found",
      status: 404,
    });
  });

  test("业务 { success: false } 抛 ApiRequestError", async () => {
    const response = okResponse({ success: false, error: "业务失败" }, 200);

    await expect(parseApiResponse(response)).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "业务失败",
      status: 200,
    });
  });

  test("响应体非法 JSON 时按 HTTP 状态判定并使用 fallback 文案", async () => {
    const response = new Response("<html>error</html>", { status: 500 });

    await expect(parseApiResponse(response, "兜底失败")).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "兜底失败",
      status: 500,
    });
  });

  test("无 error 字段的非 2xx 响应使用 fallback 文案", async () => {
    const response = okResponse({}, 500);

    await expect(parseApiResponse(response, "请求失败")).rejects.toMatchObject({
      message: "请求失败",
      status: 500,
    });
  });

  test("HTTP 204 空响应按成功处理并返回空对象", async () => {
    const response = new Response(null, { status: 204 });

    await expect(parseApiResponse(response)).resolves.toEqual({});
  });

  test("2xx 但响应体非 JSON 时返回空对象（不抛错）", async () => {
    const response = new Response("<html>ok</html>", { status: 200 });

    await expect(parseApiResponse(response)).resolves.toEqual({});
  });

  test("服务端英文错误文案映射为中文（Unauthorized / Forbidden）", async () => {
    await expect(parseApiResponse(okResponse({ error: "Unauthorized" }, 401))).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "登录状态已失效，请重新登录",
      status: 401,
    });
    await expect(parseApiResponse(okResponse({ error: "Forbidden" }, 403))).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "没有权限执行此操作",
      status: 403,
    });
  });

  test("自定义中文错误文案不被通用映射覆盖", async () => {
    await expect(parseApiResponse(okResponse({ error: "该邮箱已被使用" }, 409))).rejects.toMatchObject({
      message: "该邮箱已被使用",
      status: 409,
    });
  });
});

describe("apiFetcher / apiMutate", () => {
  test("apiFetcher 直接 GET 目标路径", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ success: true, data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiFetcher("/api/posts?page=1");

    expect(fetchMock).toHaveBeenCalledWith("/api/posts?page=1");
    expect(data).toEqual({ success: true, data: [] });
  });

  test("apiMutate 默认携带 JSON Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiMutate("/api/admin/comments", { method: "POST", body: JSON.stringify({ status: "APPROVED" }) });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/comments",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  test("apiMutate 允许调用方覆盖 headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiMutate("/api/cron/ai-news", {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cron/ai-news",
      expect.objectContaining({ headers: { Authorization: "Bearer secret" } }),
    );
  });
});

describe("ApiRequestError / toErrorMessage", () => {
  test("ApiRequestError 携带 status", () => {
    const error = new ApiRequestError("失败", 403);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiRequestError");
    expect(error.status).toBe(403);
  });

  test("toErrorMessage 收敛未知错误", () => {
    expect(toErrorMessage(new Error("具体错误"))).toBe("具体错误");
    expect(toErrorMessage({ code: "x" })).toBe("请求失败，请稍后重试");
  });

  test("toErrorMessage 将网络异常收敛为中文文案", () => {
    expect(toErrorMessage(new TypeError("Failed to fetch"))).toBe("网络异常，请检查网络连接后重试");
  });
});
