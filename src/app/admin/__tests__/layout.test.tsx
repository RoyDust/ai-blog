import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
const redirectError = new Error("NEXT_REDIRECT");
const redirect = vi.fn(() => {
  throw redirectError;
});

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/components/admin/shell/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => children,
}));

describe("admin route layout auth redirect", () => {
  beforeEach(() => {
    redirect.mockReset();
    getServerSession.mockReset();
  });

  test("redirects anonymous users to login with admin callback", async () => {
    getServerSession.mockResolvedValue(null);

    const { default: AdminRouteLayout } = await import("../layout");

    await expect(AdminRouteLayout({ children: null })).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=%2Fadmin");
  });

  test("redirects non-admin users to login with not-admin error", async () => {
    getServerSession.mockResolvedValue({
      user: { id: "user-1", role: "AUTHOR", name: "Author" },
    });

    const { default: AdminRouteLayout } = await import("../layout");

    await expect(AdminRouteLayout({ children: null })).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledWith("/login?error=not-admin&callbackUrl=%2Fadmin");
  });
});
