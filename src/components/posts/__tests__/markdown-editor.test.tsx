import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MarkdownEditor } from "@/components/posts/MarkdownEditor";
import { compressImageForUpload } from "@/lib/client-image-compression";

vi.mock("@/lib/client-image-compression", () => ({
  compressImageForUpload: vi.fn(),
}));

const compressImageForUploadMock = vi.mocked(compressImageForUpload);

beforeEach(() => {
  compressImageForUploadMock.mockImplementation(async (file) => ({
    file,
    originalFile: file,
    compressed: false,
    originalSize: file.size,
    outputSize: file.size,
    skippedReason: "not-smaller",
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

  test("applies syntax highlighting in live preview fenced code blocks", () => {
    const { container } = render(
      <MarkdownEditor value={"```ts\nconst value = 1\n```"} onChange={vi.fn()} />
    );

    expect(container.querySelector("pre code")?.className).toContain("hljs");
  });

  test("wraps the selected text with bold markers and restores the selection", async () => {
    function Wrapper() {
      const [value, setValue] = useState("hello world");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    render(<Wrapper />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(6, 11);
    fireEvent.select(textarea);

    fireEvent.click(screen.getByRole("button", { name: /加粗/ }));

    await waitFor(() => {
      expect(textarea).toHaveValue("hello **world**");
    });
    await waitFor(() => {
      expect(textarea.selectionStart).toBe(8);
      expect(textarea.selectionEnd).toBe(13);
    });
    expect(textarea).toHaveFocus();
  });

  test("inserts paired markers at the cursor and places the caret between them", async () => {
    function Wrapper() {
      const [value, setValue] = useState("hello world");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    render(<Wrapper />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(5, 5);
    fireEvent.select(textarea);

    fireEvent.click(screen.getByRole("button", { name: /加粗/ }));

    await waitFor(() => {
      expect(textarea).toHaveValue("hello**** world");
    });
    await waitFor(() => {
      expect(textarea.selectionStart).toBe(7);
      expect(textarea.selectionEnd).toBe(7);
    });
    expect(textarea).toHaveFocus();
  });

  test("inserts a heading prefix at the cursor and keeps the caret after the marker", async () => {
    function Wrapper() {
      const [value, setValue] = useState("hello world");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    render(<Wrapper />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(6, 6);
    fireEvent.select(textarea);

    fireEvent.click(screen.getByRole("button", { name: /二级标题/ }));

    await waitFor(() => {
      expect(textarea).toHaveValue("hello ## world");
    });
    await waitFor(() => {
      expect(textarea.selectionStart).toBe(9);
      expect(textarea.selectionEnd).toBe(9);
    });
  });

  test("renders qiniu image upload trigger and hides plain image button", () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /上传图片/ })).toBeInTheDocument();
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
    const compressedFile = new File(["small"], "demo.png", { type: "image/png" });

    compressImageForUploadMock.mockResolvedValueOnce({
      file: compressedFile,
      originalFile: file,
      compressed: true,
      originalSize: file.size,
      outputSize: compressedFile.size,
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(compressImageForUploadMock).toHaveBeenCalledWith(file, "markdown");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      contentType: "image/png",
      filename: "demo.png",
    });
    expect((fetchMock.mock.calls[1][1]?.body as FormData).get("file")).toBe(compressedFile);
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

  test("adds safe target and rel attributes to external http(s) and protocol-relative links while degrading unsafe schemes", () => {
    render(
      <MarkdownEditor
        value={
          "[外链](https://example.com/docs) 与 [协议相对](//cdn.example.com/asset) 与 [站内](/posts/hello) 与 [锚点](#sec) 与 [脚本](javascript:alert(1)) 与 [未知协议](irc://irc.example.com/room)"
        }
        onChange={vi.fn()}
      />,
    );

    const externalLink = screen.getByRole("link", { name: "外链" });
    expect(externalLink).toHaveAttribute("href", "https://example.com/docs");
    expect(externalLink).toHaveAttribute("target", "_blank");
    expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");

    const protocolRelativeLink = screen.getByRole("link", { name: "协议相对" });
    expect(protocolRelativeLink).toHaveAttribute("href", "//cdn.example.com/asset");
    expect(protocolRelativeLink).toHaveAttribute("target", "_blank");
    expect(protocolRelativeLink).toHaveAttribute("rel", "noopener noreferrer");

    const internalLink = screen.getByRole("link", { name: "站内" });
    expect(internalLink).toHaveAttribute("href", "/posts/hello");
    expect(internalLink).not.toHaveAttribute("target");

    const anchorLink = screen.getByRole("link", { name: "锚点" });
    expect(anchorLink).toHaveAttribute("href", "#sec");
    expect(anchorLink).not.toHaveAttribute("target");

    expect(screen.queryByRole("link", { name: "脚本" })).toBeNull();
    expect(screen.getByText("脚本").tagName).toBe("SPAN");
    expect(screen.queryByRole("link", { name: "未知协议" })).toBeNull();
    expect(screen.getByText("未知协议").tagName).toBe("SPAN");
  });

  test("preserves concurrent user typing across async image upload via placeholder replacement", async () => {
    let resolveUpload!: (value: unknown) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: "token-1",
            key: "posts/content/concurrent.png",
            domain: "http://project.roydust.top",
            uploadUrl: "https://upload.qiniup.com",
          },
        }),
      })
      .mockImplementationOnce(() => uploadPromise);

    vi.stubGlobal("fetch", fetchMock);

    function Wrapper() {
      const [value, setValue] = useState("第一段\n\n");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    render(<Wrapper />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    fireEvent.select(textarea);

    const file = new File(["image"], "concurrent.png", { type: "image/png" });
    fireEvent.paste(textarea, {
      clipboardData: {
        items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
      },
    });

    // 上传开始时立即写入唯一占位符
    await waitFor(() => {
      expect(textarea.value).toMatch(/^第一段\n\n!\[上传中\.\.\.\]\(uploading:\/\/[^)]+\)$/);
    });

    // 用户在上传尚未完成时继续输入正文
    const withConcurrentTyping = `${textarea.value}\n\n上传期间继续输入的第二段`;
    fireEvent.change(textarea, { target: { value: withConcurrentTyping } });
    expect(textarea.value).toContain("上传期间继续输入的第二段");

    resolveUpload({
      ok: true,
      json: async () => ({ key: "posts/content/concurrent.png" }),
    });

    await waitFor(() => {
      expect(textarea).toHaveValue(
        "第一段\n\n![concurrent](http://project.roydust.top/posts/content/concurrent.png)\n\n上传期间继续输入的第二段",
      );
    });
  });

  test("appends uploaded image cleanly at the end if user manually deleted placeholder during upload", async () => {
    let resolveUpload!: (value: unknown) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: "token-1",
            key: "posts/content/appended.png",
            domain: "http://project.roydust.top",
            uploadUrl: "https://upload.qiniup.com",
          },
        }),
      })
      .mockImplementationOnce(() => uploadPromise);

    vi.stubGlobal("fetch", fetchMock);

    function Wrapper() {
      const [value, setValue] = useState("初始内容");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    const { container } = render(<Wrapper />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "appended.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(textarea.value).toContain("![上传中...](uploading://");
    });

    // 用户手动删掉占位符并重写了段落
    fireEvent.change(textarea, { target: { value: "用户重写后的全文" } });

    resolveUpload({
      ok: true,
      json: async () => ({ key: "posts/content/appended.png" }),
    });

    await waitFor(() => {
      expect(textarea).toHaveValue(
        "用户重写后的全文\n\n![appended](http://project.roydust.top/posts/content/appended.png)",
      );
    });
  });

  test("normalizes network failures during image upload and cleanly removes placeholder without losing concurrent edits", async () => {
    let rejectTokenRequest!: (reason?: unknown) => void;
    const pendingFailure = new Promise((_, reject) => {
      rejectTokenRequest = reject;
    });
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => pendingFailure));

    function Wrapper() {
      const [value, setValue] = useState("Hello");
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    const { container } = render(<Wrapper />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "demo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(textarea.value).toMatch(/^Hello\n\n!\[上传中\.\.\.\]\(uploading:\/\/[^)]+\)$/);
    });

    const placeholderMatch = textarea.value.match(/!\[上传中\.\.\.\]\(uploading:\/\/[^)]+\)/);
    expect(placeholderMatch).not.toBeNull();
    fireEvent.change(textarea, {
      target: { value: `Hello world\n\n${placeholderMatch![0]}` },
    });

    rejectTokenRequest(new TypeError("Failed to fetch"));

    expect(await screen.findByRole("alert")).toHaveTextContent("网络异常，请检查网络连接后重试");
    expect(textarea).toHaveValue("Hello world");
  });
});
