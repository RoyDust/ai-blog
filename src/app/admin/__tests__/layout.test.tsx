import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
const userFindUnique = vi.fn();
const adminLayout = vi.fn(({ children }: { children: React.ReactNode }) => children);
const redirectError = new Error("NEXT_REDIRECT");
const redirect = vi.fn(() => {
  throw redirectError;
});

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
    },
  },
}));
vi.mock("@/components/admin/shell/AdminLayout", () => ({
  AdminLayout: adminLayout,
}));

describe("admin route layout auth redirect", () => {
  beforeEach(() => {
    redirect.mockReset();
    getServerSession.mockReset();
    userFindUnique.mockReset();
    adminLayout.mockClear();
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

  test("passes the latest persisted admin profile to the shell", async () => {
    getServerSession.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", name: "Stale Session", email: "stale@example.com", image: null },
    });
    userFindUnique.mockResolvedValue({
      email: "roy@example.com",
      image: "https://example.com/avatar.png",
      name: "RoyDust",
      role: "ADMIN",
    });

    const { default: AdminRouteLayout } = await import("../layout");
    const ui = await AdminRouteLayout({ children: <div>Admin content</div> });

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        email: true,
        image: true,
        name: true,
        role: true,
      },
    });
    expect(ui).toMatchObject({
      props: {
        user: {
          email: "roy@example.com",
          image: "https://example.com/avatar.png",
          label: "RoyDust",
          role: "ADMIN",
        },
      },
    });
  });
});
