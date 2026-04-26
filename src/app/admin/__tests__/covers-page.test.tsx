import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import AdminCoversPage from "../covers/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
  });
});
