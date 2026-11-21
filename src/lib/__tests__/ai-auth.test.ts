import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiApiClient: {
      findFirst,
      update,
    },
  },
}));

describe("ai auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("accepts a bearer token owned by an ADMIN with the required scope", async () => {
    findFirst.mockResolvedValueOnce({
      id: "client-1",
      ownerId: "user-1",
      name: "Codex",
      scopes: ["drafts:write", "drafts:read", "taxonomy:read"],
      owner: { role: "ADMIN" },
    });

    const { hashAiToken, requireAiClient } = await import("../ai-auth");
    const request = new Request("http://localhost/api/ai/drafts", {
      headers: {
        Authorization: "Bearer blog_ai_token_123",
      },
    });

    const client = await requireAiClient(request, "drafts:write");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: hashAiToken("blog_ai_token_123"),
        revokedAt: null,
        owner: {
          role: "ADMIN",
        },
      },
      select: {
        id: true,
        ownerId: true,
        name: true,
        scopes: true,
        owner: {
          select: {
            role: true,
          },
        },
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(client).toEqual({
      id: "client-1",
      ownerId: "user-1",
      name: "Codex",
      scopes: ["drafts:write", "drafts:read", "taxonomy:read"],
    });
  });

  test("rejects an active token when owner role is filtered out by ADMIN query", async () => {
    findFirst.mockResolvedValueOnce(null);

    const { hashAiToken, requireAiClient } = await import("../ai-auth");
    const request = new Request("http://localhost/api/ai/drafts", {
      headers: {
        Authorization: "Bearer blog_ai_token_demoted",
      },
    });

    await expect(requireAiClient(request, "drafts:write")).rejects.toMatchObject({
      status: 401,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tokenHash: hashAiToken("blog_ai_token_demoted"),
          revokedAt: null,
          owner: {
            role: "ADMIN",
          },
        },
      }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  test("rejects an active token whose owner.role is USER", async () => {
    findFirst.mockResolvedValueOnce({
      id: "client-demoted",
      ownerId: "user-demoted",
      name: "Demoted Agent",
      scopes: ["drafts:write", "drafts:read", "taxonomy:read"],
      owner: { role: "USER" },
    });

    const { requireAiClient } = await import("../ai-auth");
    const request = new Request("http://localhost/api/ai/drafts", {
      headers: {
        Authorization: "Bearer blog_ai_token_user",
      },
    });

    await expect(requireAiClient(request, "drafts:write")).rejects.toMatchObject({
      status: 403,
      message: "AI client owner must be an admin",
    });
    expect(update).not.toHaveBeenCalled();
  });

  test("rejects a valid token without the requested scope", async () => {
    findFirst.mockResolvedValueOnce({
      id: "client-1",
      ownerId: "user-1",
      name: "Codex",
      scopes: ["taxonomy:read"],
      owner: { role: "ADMIN" },
    });

    const { requireAiClient } = await import("../ai-auth");
    const request = new Request("http://localhost/api/ai/drafts", {
      headers: {
        Authorization: "Bearer blog_ai_token_123",
      },
    });

    await expect(requireAiClient(request, "drafts:write")).rejects.toMatchObject({
      status: 403,
      message: "Missing AI scope: drafts:write",
    });
  });

  test("rejects invalid stored scopes", async () => {
    findFirst.mockResolvedValueOnce({
      id: "client-2",
      ownerId: "user-2",
      name: "Codex",
      scopes: ["drafts:read", "invalid:scope"],
      owner: { role: "ADMIN" },
    });

    const { requireAiClient } = await import("../ai-auth");
    const request = new Request("http://localhost/api/ai/drafts", {
      headers: {
        Authorization: "Bearer blog_ai_token_456",
      },
    });

    await expect(requireAiClient(request, "drafts:read")).rejects.toMatchObject({
      status: 403,
      message: "Invalid AI scopes",
    });
  });
});
