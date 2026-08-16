import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type React from "react";
import { SWRConfig, mutate as clearSwrCache } from "swr";

import AdminSeriesPage from "../series/page";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const seriesPayload = [
  {
    id: "series-1",
    title: "Next.js 系列",
    slug: "nextjs-series",
    description: "系统学习 Next.js",
    coverImage: null,
    order: 2,
    createdAt: "2026-06-01T00:00:00.000Z",
    _count: { posts: 3 },
  },
];

describe("admin series page", () => {
  beforeEach(async () => {
    await clearSwrCache(() => true, undefined, { revalidate: false });
    vi.clearAllMocks();
  });

  test("renders series list and preview links", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminSeriesPage />);

    expect(await screen.findByRole("heading", { name: "文章系列" })).toBeInTheDocument();
    expect(screen.getByText("Next.js 系列")).toBeInTheDocument();
    expect(screen.getByText("/series/nextjs-series")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前台预览" })).toHaveAttribute("href", "/series");
  });

  test("creates a series with RHF values", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminSeriesPage />);

    await screen.findByText("Next.js 系列");
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "新系列" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "new-series" } });
    fireEvent.change(screen.getByLabelText("描述"), { target: { value: "新描述" } });
    fireEvent.change(screen.getByLabelText("封面 URL"), { target: { value: "https://cdn.example.com/cover.jpg" } });
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "创建系列" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/series",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "新系列",
          slug: "new-series",
          description: "新描述",
          coverImage: "https://cdn.example.com/cover.jpg",
          order: 5,
        }),
      }),
    ));
  });

  test("loads a row into the form and submits an edit", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminSeriesPage />);

    await screen.findByText("Next.js 系列");
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "Next.js 深入系列" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/series",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          id: "series-1",
          title: "Next.js 深入系列",
          slug: "nextjs-series",
          description: "系统学习 Next.js",
          coverImage: "",
          order: 2,
        }),
      }),
    ));
  });

  test("shows Chinese field errors and does not submit invalid series form", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminSeriesPage />);

    await screen.findByText("Next.js 系列");
    fireEvent.click(screen.getByRole("button", { name: "创建系列" }));

    expect(await screen.findByText("请输入系列标题")).toBeInTheDocument();
    expect(screen.getByText("请输入 slug")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/series", expect.objectContaining({ method: "POST" }));
  });

  test("disables the submit button while series creation is pending", async () => {
    let resolveCreate: (response: Response) => void = () => undefined;
    const createResponse = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = mockFetch((input, init) => {
      if (String(input) === "/api/admin/series" && init?.method === "POST") {
        return createResponse;
      }

      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminSeriesPage />);

    await screen.findByText("Next.js 系列");
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "新系列" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "new-series" } });
    fireEvent.click(screen.getByRole("button", { name: "创建系列" }));

    const pendingButton = await screen.findByRole("button", { name: "保存中..." });
    expect(pendingButton).toBeDisabled();

    resolveCreate(jsonResponse({ success: true, data: { ...seriesPayload[0], id: "series-2" } }));

    await waitFor(() => expect(screen.getByRole("button", { name: "创建系列" })).not.toBeDisabled());
  });
});

function renderWithSWR(ui: React.ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {ui}
    </SWRConfig>,
  );
}

function mockFetch(
  override?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response | undefined,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const overrideResponse = override?.(input, init);
    if (overrideResponse) {
      return overrideResponse;
    }

    const url = String(input);

    if (url === "/api/admin/series" && !init) {
      return jsonResponse({ success: true, data: seriesPayload });
    }

    if (url === "/api/admin/series" && (init?.method === "POST" || init?.method === "PATCH")) {
      return jsonResponse({ success: true, data: seriesPayload[0] });
    }

    if (url.startsWith("/api/admin/series?") && init?.method === "DELETE") {
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: true, data: seriesPayload });
  });
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response;
}
