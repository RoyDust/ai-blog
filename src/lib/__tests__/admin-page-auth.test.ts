import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSessionMock = vi.fn();
const redirectError = new Error("NEXT_REDIRECT");
const redirectMock = vi.fn(() => {
  throw redirectError;
});

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("requireAdminPageSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("redirects anonymous users to the login prompt", async () => {
    getServerSessionMock.mockResolvedValueOnce(null);

    const { requireAdminPageSession } = await import("../admin-page-auth");

    await expect(requireAdminPageSession()).rejects.toThrow(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/?login=1&callbackUrl=%2Fadmin");
  });

  test("redirects deleted users whose session lookup throws 'Session user no longer exists'", async () => {
    getServerSessionMock.mockRejectedValueOnce(new Error("Session user no longer exists"));

    const { requireAdminPageSession } = await import("../admin-page-auth");

    await expect(requireAdminPageSession()).rejects.toThrow(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/?login=1&callbackUrl=%2Fadmin");
  });

  test("rethrows unexpected session errors instead of masking database outages", async () => {
    getServerSessionMock.mockRejectedValueOnce(new Error("Database unavailable"));

    const { requireAdminPageSession } = await import("../admin-page-auth");

    await expect(requireAdminPageSession()).rejects.toThrow("Database unavailable");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  test("redirects demoted USER accounts with not-admin error", async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: { id: "user-1", role: "USER", email: "user@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    });

    const { requireAdminPageSession } = await import("../admin-page-auth");

    await expect(requireAdminPageSession()).rejects.toThrow(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/?login=1&error=not-admin&callbackUrl=%2Fadmin");
  });

  test("returns the verified admin session when user role is ADMIN", async () => {
    const adminSession = {
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com", name: "Admin" },
      expires: "2099-01-01T00:00:00.000Z",
    };
    getServerSessionMock.mockResolvedValueOnce(adminSession);

    const { requireAdminPageSession } = await import("../admin-page-auth");

    await expect(requireAdminPageSession()).resolves.toEqual(adminSession);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  test("deduplicates session reads within a single React.cache request scope", async () => {
    vi.resetModules();
    vi.doMock("react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("react")>();
      return {
        ...actual,
        cache: <T extends (...args: never[]) => unknown>(fn: T) => {
          const memo = new Map<string, unknown>();
          return ((...args: Parameters<T>) => {
            const key = JSON.stringify(args);
            if (!memo.has(key)) {
              memo.set(key, fn(...args));
            }
            return memo.get(key);
          }) as T;
        },
      };
    });

    try {
      const adminSession = {
        user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      getServerSessionMock.mockResolvedValueOnce(adminSession);

      const { requireAdminPageSession } = await import("../admin-page-auth");
      const [first, second] = await Promise.all([requireAdminPageSession(), requireAdminPageSession("/admin/settings")]);

      expect(first).toEqual(adminSession);
      expect(second).toEqual(adminSession);
      expect(getServerSessionMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock("react");
      vi.resetModules();
    }
  });
});
