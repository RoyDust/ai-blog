import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AiNewsSourceFormDialog } from "../AiNewsSourceFormDialog";
import type { PublicAiNewsSource } from "../types";

const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

function aiNewsSource(overrides: Partial<PublicAiNewsSource> = {}): PublicAiNewsSource {
  return {
    id: "source-1",
    type: "RSS",
    name: "旧来源",
    url: "https://example.com/feed.xml",
    homepage: "https://example.com",
    category: "industry",
    enabled: true,
    weight: 80,
    minScore: 30,
    fetchLimit: 20,
    settings: {},
    editable: true,
    deletable: true,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestMessage: null,
    lastFetchedItemCount: null,
    stats: {
      recentRunCount: 0,
      recentCandidateCount: 0,
      recentSelectedCount: 0,
      recentFailureCount: 0,
    },
    healthWarnings: [],
    ...overrides,
  };
}

describe("AiNewsSourceFormDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    toastErrorMock.mockReset();
  });

  test("validates required fields with Chinese messages", async () => {
    const onSubmit = vi.fn();

    render(
      <AiNewsSourceFormDialog
        open
        source={null}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.submit(screen.getByRole("button", { name: "保存来源" }).closest("form")!);

    expect(await screen.findByText("请输入来源名称")).toBeInTheDocument();
    expect(await screen.findByText("请输入来源 URL")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("submits valid RSS source values and closes after success", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <AiNewsSourceFormDialog
        open
        source={null}
        saving={false}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("来源名称"), { target: { value: "Vercel Blog" } });
    fireEvent.change(screen.getByLabelText("来源 URL"), { target: { value: "https://vercel.com/feed.xml" } });
    fireEvent.change(screen.getByLabelText("主页 URL"), { target: { value: "https://vercel.com" } });
    fireEvent.change(screen.getByLabelText("权重"), { target: { value: "120" } });
    fireEvent.submit(screen.getByRole("button", { name: "保存来源" }).closest("form")!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RSS",
          name: "Vercel Blog",
          url: "https://vercel.com/feed.xml",
          homepage: "https://vercel.com",
          category: "industry",
          enabled: true,
          weight: "120",
        }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("keeps the dialog open and shows a toast when submission fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("保存失败"));
    const onOpenChange = vi.fn();

    render(
      <AiNewsSourceFormDialog
        open
        source={null}
        saving={false}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("来源名称"), { target: { value: "Vercel Blog" } });
    fireEvent.change(screen.getByLabelText("来源 URL"), { target: { value: "https://vercel.com/feed.xml" } });
    fireEvent.submit(screen.getByRole("button", { name: "保存来源" }).closest("form")!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(toastErrorMock).toHaveBeenCalledWith("保存失败");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("allows Hacker News sources without URL and keeps comment settings", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AiNewsSourceFormDialog
        open
        source={null}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("来源类型"), { target: { value: "HACKERNEWS" } });
    fireEvent.change(screen.getByLabelText("来源名称"), { target: { value: "Hacker News" } });
    expect(screen.getByLabelText("评论条数")).toHaveValue(3);
    expect(screen.getByLabelText("评论截断长度")).toHaveValue(500);
    fireEvent.submit(screen.getByRole("button", { name: "保存来源" }).closest("form")!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "HACKERNEWS",
          name: "Hacker News",
          url: "",
          commentLimit: "3",
          commentTextMaxLength: "500",
        }),
      );
    });
  });

  test("resets editable fields when switching source records", () => {
    const { rerender } = render(
      <AiNewsSourceFormDialog
        open
        source={aiNewsSource({ name: "旧来源" })}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("来源名称")).toHaveValue("旧来源");

    rerender(
      <AiNewsSourceFormDialog
        open
        source={aiNewsSource({ id: "source-2", name: "新来源" })}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("来源名称")).toHaveValue("新来源");
  });

  test("按「基本信息」与「抓取与校验」两组渲染字段", () => {
    render(
      <AiNewsSourceFormDialog
        open
        source={null}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const basicGroup = screen.getByRole("group", { name: "基本信息" });
    const fetchGroup = screen.getByRole("group", { name: "抓取与校验" });

    expect(basicGroup).toBeInTheDocument();
    expect(fetchGroup).toBeInTheDocument();

    // 基本信息组包含基础字段与启用开关
    expect(within(basicGroup).getByLabelText("来源名称")).toBeInTheDocument();
    expect(within(basicGroup).getByLabelText("来源 URL")).toBeInTheDocument();
    expect(within(basicGroup).getByLabelText("主页 URL")).toBeInTheDocument();
    expect(within(basicGroup).getByLabelText("权重")).toBeInTheDocument();
    expect(within(basicGroup).getByLabelText("默认参与日报")).toBeInTheDocument();

    // 抓取与校验组包含抓取/校验相关字段
    expect(within(fetchGroup).getByLabelText("抓取上限")).toBeInTheDocument();
    expect(within(fetchGroup).getByLabelText("最小分数")).toBeInTheDocument();
  });
});
