export function clearAdminSessionStorage() {
  if (typeof window === "undefined") return;

  const exactLocalStorageKeys = [
    "vben_admin_collapsed",
    "vben_admin_tabs",
    "author:draft:new",
  ];
  const localStorageKeyPrefixes = ["author:draft:edit:"];

  try {
    const storage = window.localStorage;
    exactLocalStorageKeys.forEach((key) => {
      storage.removeItem(key);
    });

    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && localStorageKeyPrefixes.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Ignore SecurityError / QuotaExceededError when browser storage is disabled.
  }
}

export function clearAllSessionData() {
  if (typeof window === "undefined") return;

  clearAdminSessionStorage();

  const cookieNames = [
    "next-auth.session-token",
    "next-auth.callback-url",
    "__next-auth_basic_session",
    "__Secure-next-auth.session-token",
    "next-auth.pkce.code_verifier",
    "next-auth.verifier",
  ];

  try {
    cookieNames.forEach((name) => {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=localhost;`;
    });

    const cookies = document.cookie.split(";");
    cookies.forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (name && name.includes("next")) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      }
    });
  } catch (error) {
    console.error("Error clearing cookies:", error);
  }
}
