export function getApiErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const candidate = (data as { error?: string; detail?: string }).error ?? (data as { detail?: string }).detail;

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return fallback;
}

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

export function requestApi(path: string, init?: RequestInit) {
  return fetch(path, init);
}
