import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/motion", () => ({
  MotionReveal: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

const guidesPayload = [
  {
    id: "guide-1",
    title: "工程入门",
    slug: "engineering-start",
    description: "从这里开始",
    status: "draft",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    posts: [
      {
        id: "row-1",
        order: 1,
        note: "先读这一篇",
        post: { id: "post-1", title: "First Post", slug: "first-post", published: true, deletedAt: null },
      },
    ],
    _count: { posts: 1 },
  },
];

const postsPayload = [
  { id: "post-1", title: "First Post", slug: "first-post", published: true, deletedAt: null },
  { id: "post-2", title: "Second Post", slug: "second-post", published: true, deletedAt: null },
];

describe("admin topic guides page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders guide status and ordered posts", async () => {
    const fetchMock = mockFetch();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { default: AdminTopicGuidesPage } = await import("../topic-guides/page");
      render(<AdminTopicGuidesPage />);

      expect(await screen.findByRole("heading", { name: "专题导读" })).toBeInTheDocument();
      expect(screen.getByText("工程入门")).toBeInTheDocument();
      expect(screen.getAllByText("草稿").length).toBeGreaterThan(0);
      expect(screen.getByText("1. First Post")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "前台预览" })).toHaveAttribute("href", "/guides");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("creates a guide from selected post ids", async () => {
    const fetchMock = mockFetch();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { default: AdminTopicGuidesPage } = await import("../topic-guides/page");
      render(<AdminTopicGuidesPage />);

      await screen.findByText("First Post");
      fireEvent.change(screen.getByLabelText("标题"), { target: { value: "New Guide" } });
      fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "new-guide" } });
      fireEvent.click(screen.getByLabelText(/Second Post/));
      fireEvent.change(screen.getByLabelText("Second Post 导读备注"), { target: { value: "第二篇备注" } });
      fireEvent.click(screen.getByRole("button", { name: "创建专题" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/topic-guides",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            title: "New Guide",
            slug: "new-guide",
            description: "",
            status: "draft",
            posts: [{ postId: "post-2", note: "第二篇备注" }],
          }),
        }),
      ));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("can publish and archive a guide", async () => {
    const fetchMock = mockFetch();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { default: AdminTopicGuidesPage } = await import("../topic-guides/page");
      render(<AdminTopicGuidesPage />);

      await screen.findByText("工程入门");
      fireEvent.click(screen.getByRole("button", { name: "发布" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/topic-guides/guide-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "published" }),
        }),
      ));

      fireEvent.click(screen.getByRole("button", { name: "归档" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/topic-guides/guide-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "archived" }),
        }),
      ));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.startsWith("/api/admin/posts")) {
      return jsonResponse({ success: true, data: postsPayload });
    }

    if (url === "/api/admin/topic-guides" && !init) {
      return jsonResponse({ success: true, data: guidesPayload });
    }

    if (url === "/api/admin/topic-guides" && init?.method === "POST") {
      return jsonResponse({ success: true, data: { ...guidesPayload[0], id: "guide-2" } });
    }

    if (url.startsWith("/api/admin/topic-guides/") && init?.method === "PATCH") {
      return jsonResponse({ success: true, data: guidesPayload[0] });
    }

    if (url.startsWith("/api/admin/topic-guides/") && init?.method === "DELETE") {
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: true, data: guidesPayload });
  });
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response;
}
