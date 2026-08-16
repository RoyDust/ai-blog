/**
 * 客户端统一 API 访问层（SWR 底座）。
 *
 * 职责：
 * - 统一响应解析：HTTP 非 2xx 或业务 `{ success: false }` 一律抛出 ApiRequestError
 * - `apiFetcher` 作为 SWR 全局 fetcher（GET 语义）
 * - `apiMutate` 作为变更请求入口（POST/PATCH/DELETE），默认 JSON 头
 *
 * 约定：
 * - 错误信息复用 `admin-api-client.ts` 的 getApiErrorMessage，保持与后台现有文案一致
 * - 本模块只处理“传输与格式”问题；业务错误仍由调用方决定如何展示（toast / 内联）
 */
import { getApiErrorMessage } from "@/lib/admin-api-client";
import { buildLoginPromptPath } from "@/lib/login-redirect";

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

/** 仅后台接口的 401 需要统一跳转登录弹层。 */
export function shouldRedirectAdminUnauthorized(error: unknown, key: unknown): boolean {
  return (
    typeof key === "string" &&
    key.startsWith("/api/admin") &&
    error instanceof ApiRequestError &&
    error.status === 401
  );
}

/** 局部 SWR onError 也必须调用本函数，避免覆盖后台 401 的登录跳转。 */
export function handleGlobalSwrError(error: unknown, key: unknown) {
  if (typeof window === "undefined" || !shouldRedirectAdminUnauthorized(error, key)) {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  window.location.assign(buildLoginPromptPath({ callbackUrl: currentPath }));
}

/**
 * 解析并统一校验 API 响应。
 * 触发错误的条件：HTTP 非 2xx，或响应体为 `{ success: false }`。
 */
export async function parseApiResponse<T>(response: Response, fallback = "请求失败"): Promise<T> {
  const data = await response.json().catch(() => ({}));

  const businessFailure = data && typeof data === "object" && (data as { success?: boolean }).success === false;

  if (!response.ok || businessFailure) {
    throw new ApiRequestError(getApiErrorMessage(data, fallback), response.status);
  }

  return data as T;
}

/**
 * SWR 全局 fetcher：GET 语义。
 * 传入的 path 即 SWR key；有 query 时请调用方先拼好完整 URL。
 */
export async function apiFetcher<T>(path: string): Promise<T> {
  const response = await fetch(path);

  return parseApiResponse<T>(response);
}

/**
 * 变更请求入口：POST / PATCH / DELETE。
 * 默认携带 JSON Content-Type；调用方可通过 init.headers 覆盖。
 */
export async function apiMutate<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { headers, ...rest } = init;

  const response = await fetch(path, {
    ...rest,
    headers: headers ?? { "Content-Type": "application/json" },
  });

  return parseApiResponse<T>(response);
}

/**
 * 把未知错误收敛为可展示的中文消息。
 * 供 catch 分支统一使用：`toast.error(toErrorMessage(error))`。
 * 网络层异常（fetch 失败抛出的 TypeError）单独收敛为中文，避免透出浏览器英文文案。
 */
export function toErrorMessage(error: unknown, fallback = "请求失败，请稍后重试") {
  if (error instanceof TypeError) {
    return "网络异常，请检查网络连接后重试";
  }

  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
