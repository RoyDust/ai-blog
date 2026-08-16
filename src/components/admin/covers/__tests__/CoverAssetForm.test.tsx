import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { apiMutate } from "@/lib/client-api";

import { CoverAssetForm } from "../CoverAssetForm";
import type { CoverAsset } from "../types";

const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/lib/client-api", () => ({
  apiMutate: vi.fn(),
  toErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const apiMutateMock = vi.mocked(apiMutate);

function coverAsset(overrides: Partial<CoverAsset> = {}): CoverAsset {
  return {
    id: "cover-1",
    url: "https://cdn.example.com/old.jpg",
    provider: "manual",
    source: "manual",
    generatedByAi: false,
    status: "archived",
    title: "旧标题",
    alt: "旧替代文本",
    description: "旧备注",
    tags: ["tech", "hero"],
    usageCount: 0,
    createdAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("CoverAssetForm", () => {
  beforeEach(() => {
    apiMutateMock.mockReset();
    toastErrorMock.mockReset();
  });

  test("validates required URL before creating a cover asset", async () => {
    render(<CoverAssetForm onSaved={vi.fn()} />);

    fireEvent.submit(screen.getByRole("button", { name: "加入图库" }).closest("form")!);

    expect(await screen.findByText("请输入图片 URL")).toBeInTheDocument();
    expect(apiMutateMock).not.toHaveBeenCalled();
  });

  test("creates a cover asset with split tags through apiMutate", async () => {
    const saved = coverAsset({ id: "cover-new", title: "新封面", tags: ["tech", "hero", "dark"] });
    apiMutateMock.mockResolvedValue({ data: saved });
    const onSaved = vi.fn();

    render(<CoverAssetForm onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("图片 URL"), { target: { value: "https://cdn.example.com/new.jpg" } });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "新封面" } });
    fireEvent.change(screen.getByLabelText("替代文本"), { target: { value: "封面替代文本" } });
    fireEvent.change(screen.getByLabelText("备注"), { target: { value: "适合技术文章" } });
    fireEvent.change(screen.getByLabelText("标签"), { target: { value: "tech， hero dark" } });
    fireEvent.submit(screen.getByRole("button", { name: "加入图库" }).closest("form")!);

    await waitFor(() => {
      expect(apiMutateMock).toHaveBeenCalledWith(
        "/api/admin/covers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            url: "https://cdn.example.com/new.jpg",
            provider: "manual",
            source: "manual",
            title: "新封面",
            alt: "封面替代文本",
            description: "适合技术文章",
            tags: ["tech", "hero", "dark"],
          }),
        }),
      );
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  test("updates editable metadata and keeps the asset status", async () => {
    const saved = coverAsset({ title: "更新后" });
    apiMutateMock.mockResolvedValue({ data: saved });
    const onSaved = vi.fn();

    render(<CoverAssetForm asset={coverAsset()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "更新后" } });
    fireEvent.submit(screen.getByRole("button", { name: "保存封面" }).closest("form")!);

    await waitFor(() => {
      expect(apiMutateMock).toHaveBeenCalledWith(
        "/api/admin/covers/cover-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            title: "更新后",
            alt: "旧替代文本",
            description: "旧备注",
            tags: ["tech", "hero"],
            status: "archived",
          }),
        }),
      );
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  test("shows request failures through toast", async () => {
    apiMutateMock.mockRejectedValue(new Error("保存封面失败：URL 已存在"));

    render(<CoverAssetForm onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("图片 URL"), { target: { value: "https://cdn.example.com/new.jpg" } });
    fireEvent.submit(screen.getByRole("button", { name: "加入图库" }).closest("form")!);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("保存封面失败：URL 已存在");
    });
  });
});
