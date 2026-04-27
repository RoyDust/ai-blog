import { describe, expect, test } from "vitest"

import { isPlaceholderAuthSecret, requireAuthSecret, resolveAuthSecret } from "../auth-secret"

describe("auth secret resolution", () => {
  test("prefers a non-placeholder NEXTAUTH_SECRET", () => {
    expect(
      resolveAuthSecret({
        NEXTAUTH_SECRET: "next-auth-secret",
        AUTH_SECRET: "auth-secret",
      }),
    ).toBe("next-auth-secret")
  })

  test("falls back to AUTH_SECRET when NEXTAUTH_SECRET is a placeholder", () => {
    expect(
      resolveAuthSecret({
        NEXTAUTH_SECRET: "replace-with-a-long-random-secret",
        AUTH_SECRET: "auth-secret",
      }),
    ).toBe("auth-secret")
  })

  test("recognizes common placeholder values", () => {
    expect(isPlaceholderAuthSecret("replace-with-a-long-random-secret")).toBe(true)
    expect(isPlaceholderAuthSecret("<redacted-auth-secret>")).toBe(true)
    expect(isPlaceholderAuthSecret("changeme")).toBe(true)
    expect(isPlaceholderAuthSecret("real-secret-value")).toBe(false)
  })

  test("requires a non-placeholder secret in production", () => {
    expect(() =>
      requireAuthSecret({
        NODE_ENV: "production",
        NEXTAUTH_SECRET: "replace-with-a-long-random-secret",
        AUTH_SECRET: "",
      } as NodeJS.ProcessEnv),
    ).toThrow("AUTH_SECRET or NEXTAUTH_SECRET must be configured")
  })
})
