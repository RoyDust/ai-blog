import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const createMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiApiClient: {
      create: createMock,
    },
  },
}));

describe("admin AI token route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createMock.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "client-1",
        name: data.name,
        scopes: data.scopes,
        createdAt: new Date("2026-04-12T00:00:00.000Z"),
      }),
    );
  });

  test("creates a scoped AI token for admins", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" },
    } as never);

    const { POST } = await import("../route");
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.token).toMatch(/^blog_ai_[a-f0-9]{64}$/);
    expect(data.data.tokenPrefix).toBe(data.data.token.slice(0, 32));
    expect(data.data.scopes).toEqual(["drafts:read", "drafts:write", "taxonomy:read"]);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Admin UI Token",
        ownerId: "admin-1",
        tokenPrefix: data.data.tokenPrefix,
        scopes: ["drafts:read", "drafts:write", "taxonomy:read"],
      }),
      select: expect.objectContaining({ id: true, name: true, scopes: true, createdAt: true }),
    }));
    expect(createMock.mock.calls[0][0].data.tokenHash).not.toBe(data.data.token);
  });

  test("rejects non-admin users", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-1", role: "USER", email: "user@example.com" },
    } as never);

    const { POST } = await import("../route");
    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Forbidden" });
    expect(createMock).not.toHaveBeenCalled();
  });
});
