const adminHomePath = "/admin";

export function getSafeLoginCallbackUrl(value: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return adminHomePath;
}

export function getPostLoginRedirect(role: string | null | undefined, callbackUrl: string) {
  if (role === "ADMIN") {
    return callbackUrl.startsWith("/admin") ? callbackUrl : adminHomePath;
  }

  return "/";
}
