import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAiClient = vi.fn();
const parseAiDraftInput = vi.fn();
const upsertAiDraft = vi.fn();

vi.mock("@/lib/ai-auth", () => ({
  requireAiClient,
}));

vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validation")>("@/lib/validation");
  return {
    ...actual,
    parseAiDraftInput,
  };
});

vi.mock("@/lib/ai-authoring", () => ({
  upsertAiDraft,
}));

describe("POST /api/ai/drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 201 when a new draft is created", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] });
    parseAiDraftInput.mockReturnValueOnce({
      externalId: "draft-001",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      tagSlugs: [],
    });
    upsertAiDraft.mockResolvedValueOnce({
      operation: "created",
      draft: { externalId: "draft-001", slug: "ai-writing" },
    });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/ai/drafts", {
      method: "POST",
      headers: {
        Authorization: "Bearer blog_ai_token_123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalId: "draft-001",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
      }),
    }));

    expect(response.status).toBe(201);
  });
});
