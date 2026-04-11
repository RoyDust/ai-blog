import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAiClient = vi.fn();
const getAiDraft = vi.fn();

vi.mock("@/lib/ai-auth", () => ({
  requireAiClient,
}));

vi.mock("@/lib/ai-authoring", () => ({
  getAiDraft,
}));

describe("GET /api/ai/drafts/[externalId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the stored draft for the authenticated client", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:read"] });
    getAiDraft.mockResolvedValueOnce({
      externalId: "draft-001",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      published: false,
      tagSlugs: [],
    });

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/ai/drafts/draft-001", {
        headers: { Authorization: "Bearer blog_ai_token_123" },
      }),
      { params: Promise.resolve({ externalId: "draft-001" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.externalId).toBe("draft-001");
  });

  test("returns 404 when the draft is missing", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:read"] });
    getAiDraft.mockResolvedValueOnce(null);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/ai/drafts/missing-draft", {
        headers: { Authorization: "Bearer blog_ai_token_123" },
      }),
      { params: Promise.resolve({ externalId: "missing-draft" }) },
    );

    expect(response.status).toBe(404);
  });
});
