import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAiClient = vi.fn();
const parseAiDraftInput = vi.fn();
const upsertAiDraft = vi.fn();
const publishAiDraftPost = vi.fn();
const generatePostReview = vi.fn();
const isAutoPublishableReview = vi.fn();

vi.mock("@/lib/ai-auth", () => ({
  requireAiClient,
}));

vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validation")>("@/lib/validation");
  return {
    ...actual,
    parseAiDraftInput,
  };

  test("auto publishes AI drafts that pass automatic review", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] });
    parseAiDraftInput.mockReturnValueOnce({
      externalId: "draft-auto",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      coverImage: "https://example.com/cover.jpg",
      tagSlugs: [],
    });
    upsertAiDraft.mockResolvedValueOnce({
      operation: "created",
      draft: { externalId: "draft-auto", postId: "post-1", slug: "ai-writing" },
    });
    generatePostReview.mockResolvedValueOnce({
      verdict: "ready",
      score: 91,
      summary: "可以发布",
      checks: [],
      suggestions: [],
    });
    isAutoPublishableReview.mockReturnValueOnce(true);
    publishAiDraftPost.mockResolvedValueOnce({ slug: "ai-writing", published: true });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/ai/drafts", {
      method: "POST",
      headers: {
        Authorization: "Bearer blog_ai_token_123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalId: "draft-auto",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(generatePostReview).toHaveBeenCalledWith(expect.objectContaining({
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
    }));
    expect(isAutoPublishableReview).toHaveBeenCalledWith(expect.objectContaining({ verdict: "ready", score: 91 }));
    expect(publishAiDraftPost).toHaveBeenCalledWith({ postId: "post-1" });
    expect(payload).toMatchObject({
      success: true,
      data: { externalId: "draft-auto", postId: "post-1", slug: "ai-writing", published: true },
      autoReview: { verdict: "ready", score: 91, published: true },
    });
  });

  test("keeps AI drafts unpublished when automatic review does not pass", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] });
    parseAiDraftInput.mockReturnValueOnce({
      externalId: "draft-needs-work",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      tagSlugs: [],
    });
    upsertAiDraft.mockResolvedValueOnce({
      operation: "created",
      draft: { externalId: "draft-needs-work", postId: "post-2", slug: "ai-writing" },
    });
    generatePostReview.mockResolvedValueOnce({
      verdict: "needs-work",
      score: 74,
      summary: "需要修改",
      checks: [],
      suggestions: ["补充结论"],
    });
    isAutoPublishableReview.mockReturnValueOnce(false);

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/ai/drafts", {
      method: "POST",
      headers: {
        Authorization: "Bearer blog_ai_token_123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalId: "draft-needs-work",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(publishAiDraftPost).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      success: true,
      data: { externalId: "draft-needs-work", postId: "post-2", slug: "ai-writing", published: false },
      autoReview: { verdict: "needs-work", score: 74, published: false },
    });
  });

});

vi.mock("@/lib/ai-authoring", () => ({
  upsertAiDraft,
  publishAiDraftPost,
}));

vi.mock("@/lib/ai-review", () => ({
  generatePostReview,
  isAutoPublishableReview,
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

  test("returns 409 when the binding points at a published post", async () => {
    const { ConflictError } = await import("@/lib/api-errors");

    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] });
    parseAiDraftInput.mockReturnValueOnce({
      externalId: "draft-002",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      tagSlugs: [],
    });
    upsertAiDraft.mockRejectedValueOnce(new ConflictError("Draft binding points to a published post"));

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/ai/drafts", {
      method: "POST",
      headers: {
        Authorization: "Bearer blog_ai_token_123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalId: "draft-002",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: "Draft binding points to a published post" });
  });

  test("returns 400 for malformed json", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/ai/drafts", {
      method: "POST",
      headers: {
        Authorization: "Bearer blog_ai_token_123",
        "Content-Type": "application/json",
      },
      body: "{",
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Malformed JSON body" });
    expect(parseAiDraftInput).not.toHaveBeenCalled();
    expect(upsertAiDraft).not.toHaveBeenCalled();
  });

  test("auto publishes AI drafts that pass automatic review", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] });
    parseAiDraftInput.mockReturnValueOnce({
      externalId: "draft-auto",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      coverImage: "https://example.com/cover.jpg",
      tagSlugs: [],
    });
    upsertAiDraft.mockResolvedValueOnce({
      operation: "created",
      draft: { externalId: "draft-auto", postId: "post-1", slug: "ai-writing" },
    });
    generatePostReview.mockResolvedValueOnce({
      verdict: "ready",
      score: 91,
      summary: "可以发布",
      checks: [],
      suggestions: [],
    });
    isAutoPublishableReview.mockReturnValueOnce(true);
    publishAiDraftPost.mockResolvedValueOnce({ slug: "ai-writing", published: true });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/ai/drafts", {
      method: "POST",
      headers: {
        Authorization: "Bearer blog_ai_token_123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalId: "draft-auto",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(generatePostReview).toHaveBeenCalledWith(expect.objectContaining({
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
    }));
    expect(isAutoPublishableReview).toHaveBeenCalledWith(expect.objectContaining({ verdict: "ready", score: 91 }));
    expect(publishAiDraftPost).toHaveBeenCalledWith({ postId: "post-1" });
    expect(payload).toMatchObject({
      success: true,
      data: { externalId: "draft-auto", postId: "post-1", slug: "ai-writing", published: true },
      autoReview: { verdict: "ready", score: 91, published: true },
    });
  });

  test("keeps AI drafts unpublished when automatic review does not pass", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] });
    parseAiDraftInput.mockReturnValueOnce({
      externalId: "draft-needs-work",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      tagSlugs: [],
    });
    upsertAiDraft.mockResolvedValueOnce({
      operation: "created",
      draft: { externalId: "draft-needs-work", postId: "post-2", slug: "ai-writing" },
    });
    generatePostReview.mockResolvedValueOnce({
      verdict: "needs-work",
      score: 74,
      summary: "需要修改",
      checks: [],
      suggestions: ["补充结论"],
    });
    isAutoPublishableReview.mockReturnValueOnce(false);

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/ai/drafts", {
      method: "POST",
      headers: {
        Authorization: "Bearer blog_ai_token_123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalId: "draft-needs-work",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(publishAiDraftPost).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      success: true,
      data: { externalId: "draft-needs-work", postId: "post-2", slug: "ai-writing", published: false },
      autoReview: { verdict: "needs-work", score: 74, published: false },
    });
  });

});