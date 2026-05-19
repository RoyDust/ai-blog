import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildArticleShareText, ShareButton } from "../ShareButton";

describe("ShareButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      share: vi.fn(),
    });
  });

  test("builds article attribution share text", () => {
    expect(
      buildArticleShareText({
        title: "Article Title",
        authorName: "Author",
        url: "https://blog.example/posts/article-title",
        sourceName: "Configured Blog",
      }),
    ).toBe(
      [
        "文章：Article Title",
        "作者：Author",
        "链接：https://blog.example/posts/article-title",
        "来源：Configured Blog",
        "著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。",
      ].join("\n"),
    );
  });

  test("copies attribution text without opening the system share menu", async () => {
    render(<ShareButton authorName="Author" slug="article-title" sourceName="Configured Blog" title="Article Title" />);

    fireEvent.click(screen.getByRole("button", { name: "分享文章" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        [
          "文章：Article Title",
          "作者：Author",
          `链接：${window.location.origin}/posts/article-title`,
          "来源：Configured Blog",
          "著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。",
        ].join("\n"),
      );
    });
    expect(navigator.share).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "分享文章" })).toHaveTextContent("已复制");
    });
  });
});
