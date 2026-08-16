/**
 * 服务端通用英文错误文案 → 中文展示文案映射。
 * 覆盖 middleware 兜底与 api-errors 的英文默认消息（Unauthorized / Forbidden / Internal server error 等），
 * 确保所有客户端错误收敛为中文（见 AGENTS.md「前端数据层与表单约定」）。
 */
const COMMON_API_ERROR_MESSAGES: Record<string, string> = {
  Unauthorized: "登录状态已失效，请重新登录",
  Forbidden: "没有权限执行此操作",
  "Internal server error": "服务器内部错误，请稍后重试",
  Conflict: "操作冲突，请稍后重试",
  "Too many requests": "请求过于频繁，请稍后重试",
  "Not found": "请求的资源不存在",
};

/**
 * Reads the public error field used by admin API routes while preserving caller-specific fallback text.
 */
export function getApiErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const candidate = (data as { error?: string; detail?: string }).error ?? (data as { detail?: string }).detail;

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return COMMON_API_ERROR_MESSAGES[candidate] ?? candidate;
    }
  }

  return fallback;
}

/**
 * Parses an admin JSON response and throws on either HTTP failure or `{ success: false }`.
 * This keeps client components from repeating response.ok / data.error branching.
 */
export async function readApiJson<T = { success?: boolean; error?: string; data?: unknown }>(
  response: Response,
  fallback = "请求失败",
): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || (data && typeof data === "object" && (data as { success?: boolean }).success === false)) {
    throw new Error(getApiErrorMessage(data, fallback));
  }

  return data as T;
}

/**
 * Thin fetch wrapper kept as the future extension point for admin request defaults.
 */
export function requestApi(path: string, init?: RequestInit) {
  return fetch(path, init);
}
