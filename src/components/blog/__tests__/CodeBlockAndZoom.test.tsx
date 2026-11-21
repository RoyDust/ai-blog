import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArticleImageZoom } from "../ArticleImageZoom";
import { CodeBlock } from "../CodeBlock";

describe("CodeBlock", () => {
  test("renders language label in header bar and copy button alongside pre", () => {
    const { container } = render(
      <CodeBlock>
        <code className="hljs language-css">{"body {\n  font-size: 20px;\n}\n"}</code>
      </CodeBlock>,
    );

    expect(container.querySelector(".code-block-shell")).toBeInTheDocument();
    expect(container.querySelector(".code-block-header")).toHaveTextContent("css");
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(container.querySelector("pre code")).toHaveTextContent("font-size: 20px;");
  });

  test("normalizes language aliases and falls back to code when unspecified", () => {
    const { rerender, container } = render(
      <CodeBlock>
        <code className="language-ts">const x = 1;</code>
      </CodeBlock>,
    );

    expect(container.querySelector(".code-block-lang")).toHaveTextContent("typescript");

    rerender(
      <CodeBlock>
        <code>plain block</code>
      </CodeBlock>,
    );

    expect(container.querySelector(".code-block-lang")).toHaveTextContent("code");
  });
});

describe("ArticleImageZoom", () => {
  test("opens a full-screen dialog preview when clicked", async () => {
    render(
      <ArticleImageZoom
        alt="架构示意图"
        className="theme-media my-8 block overflow-hidden rounded-2xl border border-[var(--reader-border)]"
        src="https://example.com/diagram.png"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "放大查看图片：架构示意图" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭图片预览" })).toBeInTheDocument();
  });
});
