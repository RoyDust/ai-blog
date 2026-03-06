import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MarkdownEditor } from "@/components/posts/MarkdownEditor";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("markdown editor", () => {
  test("renders source editor and live preview", () => {
    const onChange = vi.fn();

    const { container } = render(
      <MarkdownEditor label="内容" value="# Heading\n\n**bold**" onChange={onChange} />
    );

    expect(screen.getByLabelText("内容")).toBeInTheDocument();
    expect(screen.getByText("实时预览")).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(container.querySelector(".prose")?.className).toContain("prose-pre:rounded-xl");
  });

  test("renders qiniu image upload trigger and hides plain image button", () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /上传图片到七牛/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Image" })).toBeNull();
  });

  test("uploads image and inserts markdown into content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: "token-1",
            key: "posts/content/demo.png",
            domain: "http://project.roydust.top",
            uploadUrl: "https://upload.qiniup.com",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: "posts/content/demo.png" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    function Wrapper() {
      const [value, setValue] = useState("Hello");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    const { container } = render(<Wrapper />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "demo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole("textbox")).toHaveValue(
      "Hello\n\n![demo](http://project.roydust.top/posts/content/demo.png)"
    );
  });

  test("uploads image and inserts markdown at cursor position", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: "token-1",
            key: "posts/content/demo.png",
            domain: "http://project.roydust.top",
            uploadUrl: "https://upload.qiniup.com",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: "posts/content/demo.png" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    function Wrapper() {
      const [value, setValue] = useState("Hello world");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    const { container } = render(<Wrapper />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(6, 6);
    fireEvent.select(textarea);
    fireEvent.blur(textarea);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "demo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole("textbox")).toHaveValue(
      "Hello ![demo](http://project.roydust.top/posts/content/demo.png)world"
    );
  });

  test("does not render preview image when markdown image src is empty", () => {
    const { container } = render(<MarkdownEditor value="![alt]()" onChange={vi.fn()} />);

    expect(container.querySelector("img")).toBeNull();
  });

  test("pastes clipboard image and inserts markdown at cursor position", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: "token-1",
            key: "posts/content/paste.png",
            domain: "http://project.roydust.top",
            uploadUrl: "https://upload.qiniup.com",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: "posts/content/paste.png" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    function Wrapper() {
      const [value, setValue] = useState("Hello world");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    render(<Wrapper />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(6, 6);
    fireEvent.select(textarea);

    const file = new File(["image"], "paste.png", { type: "image/png" });
    const preventDefault = vi.fn();

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => file,
          },
        ],
      },
      preventDefault,
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole("textbox")).toHaveValue(
      "Hello ![paste](http://project.roydust.top/posts/content/paste.png)world"
    );
  });
});
