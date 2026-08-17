import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mutate as clearSwrCache } from "swr";
import { SWRConfig } from "swr";

import { usePostsList, type PostRow } from "../usePostsList";

function buildPost(id: string, published = false): PostRow {
  return {
    id,
    title: `文章 ${id}`,
    slug: `post-${id}`,
    excerpt: null,
    published,
    viewCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    author: { name: "Admin", email: "admin@example.com" },
    _count: { comments: 0, likes: 0 },
  };
}

function makeFetchMock(posts: PostRow[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "GET" && url.startsWith("/api/admin/posts")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: posts,
          pagination: { page: 1, limit: 20, total: posts.length, totalPages: 1 },
        }),
        { status: 200 },
      );
    }

    if (url === "/api/admin/posts/publish" && method === "PATCH") {
      return new Response(JSON.stringify({ success: true, data: { count: 1 } }), { status: 200 });
    }

    return new Response(JSON.stringify({ success: false }), { status: 404 });
  });
}

function renderListHook(posts: PostRow[]) {
  const fetchMock = makeFetchMock(posts);
  vi.stubGlobal("fetch", fetchMock);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
  );

  const utils = renderHook(() => usePostsList(), { wrapper });
  return { ...utils, fetchMock };
}

describe("usePostsList 发布确认（仅发布方向弹窗）", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    await clearSwrCache(() => true, undefined, { revalidate: false });
  });

  test("行级发布：先打开确认弹窗，取消后不调用接口", async () => {
    const { result, fetchMock } = renderListHook([buildPost("p1", false), buildPost("p2", true)]);
    await waitFor(() => expect(result.current.posts).toHaveLength(2));

    act(() => result.current.requestTogglePublish(result.current.posts[0]));

    expect(result.current.publishDialog.open).toBe(true);
    expect(result.current.publishDialog.row?.id).toBe("p1");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/posts/publish", expect.anything());

    act(() => result.current.cancelTogglePublish());

    expect(result.current.publishDialog.open).toBe(false);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/posts/publish", expect.anything());
  });

  test("行级发布：确认后调用发布接口并关闭弹窗", async () => {
    const { result, fetchMock } = renderListHook([buildPost("p1", false)]);
    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    act(() => result.current.requestTogglePublish(result.current.posts[0]));

    await act(async () => {
      await result.current.confirmTogglePublish();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/posts/publish",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: "p1", published: true }) }),
    );
    expect(result.current.publishDialog.open).toBe(false);
  });

  test("行级转草稿：不弹窗，直接调用接口", async () => {
    const { result, fetchMock } = renderListHook([buildPost("p2", true)]);
    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    act(() => result.current.requestTogglePublish(result.current.posts[0]));

    expect(result.current.publishDialog.open).toBe(false);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/posts/publish",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: "p2", published: false }) }),
      );
    });
  });

  test("批量发布：弹窗展示受影响篇数，确认后批量发布", async () => {
    const { result, fetchMock } = renderListHook([buildPost("p1", false), buildPost("p2", true), buildPost("p3", false)]);
    await waitFor(() => expect(result.current.posts).toHaveLength(3));

    act(() => result.current.requestBulkPublish(["p1", "p2"], true));

    expect(result.current.bulkPublishDialog.open).toBe(true);
    expect(result.current.bulkPublishDialog.count).toBe(1); // p2 已发布，不计入
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/posts/publish", expect.anything());

    await act(async () => {
      await result.current.confirmBulkPublish();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/posts/publish",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ids: ["p1"], published: true }) }),
    );
    expect(result.current.bulkPublishDialog.open).toBe(false);
  });

  test("批量转草稿：不弹窗，直接调用接口", async () => {
    const { result, fetchMock } = renderListHook([buildPost("p2", true), buildPost("p3", false)]);
    await waitFor(() => expect(result.current.posts).toHaveLength(2));

    act(() => result.current.requestBulkPublish(["p2", "p3"], false));

    expect(result.current.bulkPublishDialog.open).toBe(false);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/posts/publish",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ids: ["p2"], published: false }) }),
      );
    });
  });
});
