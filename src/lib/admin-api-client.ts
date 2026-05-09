/**
 * Reads the public error field used by admin API routes while preserving caller-specific fallback text.
 */
export function getApiErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const candidate = (data as { error?: string; detail?: string }).error ?? (data as { detail?: string }).detail;

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
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
