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

  test("accepts a bearer token with the required scope", async () => {
    findFirst.mockResolvedValueOnce({
      id: "client-1",
      ownerId: "user-1",
      name: "Codex",
      scopes: ["drafts:write", "drafts:read", "taxonomy:read"],
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
      },
      select: {
        id: true,
        ownerId: true,
        name: true,
        scopes: true,
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

  test("rejects a valid token without the requested scope", async () => {
    findFirst.mockResolvedValueOnce({
      id: "client-1",
      ownerId: "user-1",
      name: "Codex",
      scopes: ["taxonomy:read"],
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
});
