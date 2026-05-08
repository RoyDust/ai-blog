export function clearAllSessionData() {
  if (typeof window === "undefined") return;

  localStorage.clear();

  const cookieNames = [
    "next-auth.session-token",
    "next-auth.callback-url",
    "__next-auth_basic_session",
    "__Secure-next-auth.session-token",
    "next-auth.pkce.code_verifier",
    "next-auth.verifier",
  ];

  cookieNames.forEach((name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=localhost;`;
  });

  try {
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
