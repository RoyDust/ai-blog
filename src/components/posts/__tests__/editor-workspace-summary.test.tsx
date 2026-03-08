import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditorWorkspace } from "@/components/posts/EditorWorkspace";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("editor workspace summary", () => {
  test("requests AI summary and fills excerpt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { summary: "这是一段生成后的摘要。" } }),
    });

    vi.stubGlobal("fetch", fetchMock);

    function Wrapper() {
      const [excerpt, setExcerpt] = useState("");

      return (
        <EditorWorkspace
          title="测试文章"
          slug="test-post"
          content="# 标题\n\n这是一篇需要总结的文章内容。"
          excerpt={excerpt}
          coverImage=""
          onTitleChange={vi.fn()}
          onSlugChange={vi.fn()}
          onContentChange={vi.fn()}
          onExcerptChange={setExcerpt}
          onCoverImageChange={vi.fn()}
        />
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByRole("button", { name: "AI 生成摘要" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/posts/summarize",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    expect(await screen.findByDisplayValue("这是一段生成后的摘要。")).toBeInTheDocument();
  });

  test("shows returned error when summary request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "摘要生成失败" }),
      })
    );

    render(
      <EditorWorkspace
        title="测试文章"
        slug="test-post"
        content="# 标题\n\n这是一篇需要总结的文章内容。"
        excerpt=""
        coverImage=""
        onTitleChange={vi.fn()}
        onSlugChange={vi.fn()}
        onContentChange={vi.fn()}
        onExcerptChange={vi.fn()}
        onCoverImageChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "AI 生成摘要" }));

    expect(await screen.findByText("摘要生成失败")).toBeInTheDocument();
  });
});
