import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mutate as clearSwrCache, SWRConfig } from "swr";

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

import { CoverGalleryManager } from "../CoverGalleryManager";
import type { CoverAsset } from "../types";

function coverAsset(overrides: Partial<CoverAsset> = {}): CoverAsset {
  return {
    id: "cover-1",
    url: "https://cdn.example.com/covers/a.jpg",
    provider: "qiniu",
    source: "upload",
    generatedByAi: false,
    status: "active",
    title: "Tech Cover",
    alt: "Tech cover",
    tags: ["tech"],
    usageCount: 2,
    createdAt: "2026-04-26T00:00:00.000Z",
    ...overrides,
  };
}

function renderGallery() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CoverGalleryManager />
    </SWRConfig>,
  );
}

function mockGalleryFetch(options?: { deleteResponse?: () => Promise<Response> }) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    if (init?.method === "DELETE") {
      return options?.deleteResponse?.() ?? Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [coverAsset()],
            total: 1,
            page: 1,
            limit: 24,
          },
        }),
        { status: 200 },
      ),
    );
  });
}

describe("CoverGalleryManager 归档确认流", () => {
  beforeEach(async () => {
    await clearSwrCache(() => true, undefined, { revalidate: false });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  test("归档封面需先确认：确认后调用归档接口并提示成功", async () => {
    const fetchMock = mockGalleryFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderGallery();

    fireEvent.click(await screen.findByRole("button", { name: "归档" }));

    expect(screen.getByText(/归档封面“Tech Cover”？已使用的文章不会被清空。/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认归档" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/covers/cover-1",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(toastSuccessMock).toHaveBeenCalledWith("封面已归档");
    });
  });

  test("取消归档确认时不调用归档接口", async () => {
    const fetchMock = mockGalleryFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderGallery();

    fireEvent.click(await screen.findByRole("button", { name: "归档" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/covers/cover-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("归档失败时通过 toast.error 反馈", async () => {
    const fetchMock = mockGalleryFetch({
      deleteResponse: () =>
        Promise.resolve(new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderGallery();

    fireEvent.click(await screen.findByRole("button", { name: "归档" }));
    fireEvent.click(screen.getByRole("button", { name: "确认归档" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("服务器内部错误，请稍后重试");
    });
  });
});
