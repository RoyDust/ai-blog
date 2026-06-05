import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CoverPicker } from "../CoverPicker";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CoverPicker", () => {
  test("loads active covers and returns the selected asset", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [
            {
              id: "cover-1",
              url: "https://cdn.example.com/covers/a.jpg",
              provider: "qiniu",
              source: "upload",
              generatedByAi: false,
              status: "active",
              title: "Tech Cover",
              alt: "Tech cover",
              tags: [],
              usageCount: 0,
              createdAt: "2026-04-26T00:00:00.000Z",
            },
          ],
          total: 1,
          page: 1,
          limit: 50,
        },
      }),
    });
    const onSelect = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    render(<CoverPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "从图库选择" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/covers?status=active&limit=50");
    });

    fireEvent.click(await screen.findByRole("button", { name: /Tech Cover/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: "cover-1",
      url: "https://cdn.example.com/covers/a.jpg",
    }));
  });

  test("filters AI-generated covers separately", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 50,
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<CoverPicker onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "从图库选择" }));
    fireEvent.click(await screen.findByRole("button", { name: "AI 生成" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/covers?status=active&limit=50&generatedByAi=true");
    });
  });
});
