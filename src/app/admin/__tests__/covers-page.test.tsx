import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import AdminCoversPage from "../covers/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("admin covers page", () => {
  test("renders cover gallery manager", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [], total: 0, page: 1, limit: 60 },
      }),
    }));

    render(<AdminCoversPage />);

    expect(screen.getByRole("heading", { name: "封面图库" })).toBeInTheDocument();
    expect(screen.getByText("上传封面")).toBeInTheDocument();
    expect(screen.getByText("添加已有链接")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "图片类型" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "封面来源" })).not.toBeInTheDocument();
  });

  test("restores cached cover filters before loading gallery", async () => {
    window.localStorage.setItem(
      "admin:covers:list-filters",
      JSON.stringify({
        query: "tech",
        statusFilter: "active",
        imageKindFilter: "uploaded",
        page: 2,
        pageSize: 48,
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [], total: 0, page: 2, limit: 48 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminCoversPage />);

    await screen.findByRole("heading", { name: "封面图库" });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/covers?page=2&limit=48&q=tech&status=active&source=upload&generatedByAi=false");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/covers?page=1&limit=24");
    expect(screen.getByLabelText("搜索封面")).toHaveValue("tech");
  });
});
