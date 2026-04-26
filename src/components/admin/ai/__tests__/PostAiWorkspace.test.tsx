import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { PostAiWorkspace } from "../PostAiWorkspace";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PostAiWorkspace", () => {
  test("generates and applies an SEO description suggestion", async () => {
    const onApplied = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            taskId: "task-1",
            itemId: "item-1",
            action: "seo-description",
            modelId: "model-1",
            output: { seoDescription: "新的 SEO 描述" },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "post-1", seoDescription: "新的 SEO 描述" },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<PostAiWorkspace postId="post-1" onApplied={onApplied} />);

    fireEvent.click(screen.getByRole("button", { name: /生成 SEO 描述/ }));

    expect(await screen.findByText("新的 SEO 描述")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "应用建议" }));

    await waitFor(() => {
      expect(onApplied).toHaveBeenCalledWith({ id: "post-1", seoDescription: "新的 SEO 描述" });
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ postId: "post-1", action: "seo-description" });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ itemId: "item-1" });
  });

  test("generates and applies a draft suggestion without calling the apply endpoint", async () => {
    const onApplied = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          taskId: "task-1",
          itemId: "item-1",
          action: "title",
          modelId: "model-1",
          output: { titles: ["AI 草稿标题", "备选标题"] },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <PostAiWorkspace
        draft={{
          title: "草稿",
          slug: "cao-gao",
          content: "正文内容",
          excerpt: "",
          seoDescription: "",
          categoryId: "",
          tagIds: [],
        }}
        onApplied={onApplied}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /建议标题/ }));

    expect(await screen.findByText(/AI 草稿标题/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "应用建议" }));

    expect(onApplied).toHaveBeenCalledWith({ id: "draft", title: "AI 草稿标题" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      draft: {
        title: "草稿",
        slug: "cao-gao",
        content: "正文内容",
        excerpt: "",
        seoDescription: "",
        categoryId: "",
        tagIds: [],
      },
      action: "title",
    });
  });
});
