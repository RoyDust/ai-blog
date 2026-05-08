const adminHomePath = "/admin";

type LoginPromptOptions = {
  callbackUrl?: string | null;
  error?: string | null;
  registered?: boolean;
};

export function getSafeLoginCallbackUrl(value: string | null, fallback = adminHomePath) {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return fallback;
}

export function getPostLoginRedirect(role: string | null | undefined, callbackUrl: string) {
  if (role === "ADMIN") {
    return callbackUrl.startsWith("/admin") ? callbackUrl : adminHomePath;
  }

  return "/";
}

export function buildLoginPromptPath({ callbackUrl, error, registered }: LoginPromptOptions = {}) {
  const params = new URLSearchParams({ login: "1" });

  if (error) {
    params.set("error", error);
  }

  if (callbackUrl) {
    params.set("callbackUrl", callbackUrl);
  }

  if (registered) {
    params.set("registered", "true");
  }

  return `/?${params.toString()}`;
}
