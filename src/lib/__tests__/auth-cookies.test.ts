import { describe, expect, test } from "vitest";

import { authSessionCookieName, shouldUseSecureAuthCookies } from "../auth-cookies";

describe("auth cookie security", () => {
  test("uses one explicit session cookie name across auth and middleware", () => {
    expect(authSessionCookieName).toBe("next-auth.session-token");
  });
  test("does not force secure cookies for an explicitly configured HTTP site", () => {
    expect(
      shouldUseSecureAuthCookies({
        NODE_ENV: "production",
        NEXTAUTH_URL: "http://roydust.top",
        NEXT_PUBLIC_SITE_URL: "",
        SITE_URL: "",
      }),
    ).toBe(false);
  });

  test("uses secure cookies for HTTPS sites", () => {
    expect(
      shouldUseSecureAuthCookies({
        NODE_ENV: "production",
        NEXTAUTH_URL: "https://roydust.top",
        NEXT_PUBLIC_SITE_URL: "",
        SITE_URL: "",
      }),
    ).toBe(true);
  });
});
