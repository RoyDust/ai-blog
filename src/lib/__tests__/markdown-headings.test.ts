import { render } from "@testing-library/react";
import React, { type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { describe, expect, test } from "vitest";
import {
  classifyMarkdownLink,
  createHeadingSlugger,
  extractHeadingText,
  extractHeadings,
  slugifyHeading,
  stripInlineMarkdown,
  stripTrailingAtxHashes,
} from "../markdown-headings";

describe("markdown-headings", () => {
  describe("fenced code block filtering in extractHeadings", () => {
    test("ignores Bash, Python, and YAML # comments inside ``` and ~~~ fences (including up to 3 leading spaces)", () => {
      const markdown = [
        "# 顶层导言",
        "",
        "```bash",
        "# 安装依赖",
        "## 配置环境变量",
        "pnpm install",
        "```",
        "",
        "   ~~~python",
        "# step 1",
        "### compute embedding",
        "   ~~~",
        "",
        "  ```yaml",
        "# server port",
        "port: 3000",
        "  ```  ",
        "",
        "## 真实章节",
      ].join("\n");

      expect(extractHeadings(markdown)).toEqual([
        { id: "顶层导言", text: "顶层导言", level: 1 },
        { id: "真实章节", text: "真实章节", level: 2 },
      ]);
    });

    test("does not close outer 4-backtick or 4-tilde fences on shorter inner fences or mismatched fence characters", () => {
      const markdown = [
        "## 章节一",
        "",
        "````markdown",
        "```bash",
        "# 内层 Bash 注释",
        "```",
        "~~~",
        "# 波浪线也无法闭合反引号外层围栏",
        "~~~",
        "## 嵌在四反引号示例里的标题",
        "````",
        "",
        "~~~~yaml",
        "~~~",
        "# 三波浪线不能闭合四波浪线",
        "```",
        "~~~~~",
        "",
        "## 章节二",
      ].join("\r\n");

      expect(extractHeadings(markdown)).toEqual([
        { id: "章节一", text: "章节一", level: 2 },
        { id: "章节二", text: "章节二", level: 2 },
      ]);
    });

    test("treats single-line inline triple-backtick code in paragraphs as inline code rather than an unclosed fence", () => {
      const markdown = [
        "段落中出现 ```inline code``` 时不应吞掉后续标题。",
        "",
        "## 后续正常标题",
        "",
        "    # 4 空格缩进代码块里的注释也不应进入目录",
      ].join("\n");

      expect(extractHeadings(markdown)).toEqual([
        { id: "后续正常标题", text: "后续正常标题", level: 2 },
      ]);
    });
  });

  describe("inline Markdown stripping & trailing ATX hashes", () => {
    test("strips inline code, multi-backtick code, images, links, bold/italic/strike, escapes, and trailing ATX hashes", () => {
      expect(stripInlineMarkdown("使用 `useSWR` 请求")).toBe("使用 useSWR 请求");
      expect(stripInlineMarkdown("双反引号 ``a`b`` 与 `` `wrap` ``")).toBe("双反引号 a`b 与 `wrap`");
      expect(stripInlineMarkdown("图标 ![alt text](https://example.com/a.png \"Logo\") 说明")).toBe(
        "图标 alt text 说明",
      );
      expect(stripInlineMarkdown("阅读 [官方文档](https://en.wikipedia.org/wiki/React_(software) \"Title (1)\")")).toBe(
        "阅读 官方文档",
      );
      expect(stripInlineMarkdown("**bold** __bold2__ *italic* _italic2_ ~~strike~~")).toBe(
        "bold bold2 italic italic2 strike",
      );
      expect(stripInlineMarkdown("保留 snake_case_identifier 与 `a_b_c` 及 `**literal**`")).toBe(
        "保留 snake_case_identifier 与 a_b_c 及 **literal**",
      );
      expect(stripInlineMarkdown("Escaped \\#1 and \\*star\\*")).toBe("Escaped #1 and *star*");

      expect(stripTrailingAtxHashes("Title ##  ")).toBe("Title");
      expect(stripTrailingAtxHashes("C# 语言特性")).toBe("C# 语言特性");
      expect(stripTrailingAtxHashes("C#")).toBe("C#");
      expect(stripTrailingAtxHashes("Title \\###")).toBe("Title \\###");
    });

    test("produces 100% identical heading IDs between extractHeadings and ReactMarkdown h1-h3 DOM rendering", () => {
      const markdown = [
        "## 使用 `useSWR` 请求",
        "### 双反引号 ``a`b`` 边界",
        "## 结合 **加粗**、_斜体_ 与 ~~删除线~~",
        "### 参考 [`useSWR` 文档](https://swr.vercel.app \"SWR\") 与 [![Badge](https://img.example/b.svg)](https://ci.example)",
        "## 图标 ![架构图](https://img.example/arch.png) 展示 ##",
        "## 转义 \\# 标题与 C# 语言",
        "#### 四级同名标题",
        "## 四级同名标题",
        "## 使用 useSWR 请求",
        "## 🎉",
        "## 🚀",
      ].join("\n");

      const tocHeadings = extractHeadings(markdown);
      const renderSlugger = createHeadingSlugger();

      const makeHeading = (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") => {
        function HeadingRenderer({ children }: ComponentProps<"h2"> & { node?: unknown }) {
          const id = renderSlugger.slug(extractHeadingText(children));
          return React.createElement(Tag, { id }, children);
        }
        return HeadingRenderer;
      };

      const components: Components = {
        h1: makeHeading("h1"),
        h2: makeHeading("h2"),
        h3: makeHeading("h3"),
        h4: makeHeading("h4"),
        h5: makeHeading("h5"),
        h6: makeHeading("h6"),
      };

      const { container } = render(
        React.createElement(
          ReactMarkdown,
          {
            components,
            rehypePlugins: [rehypeHighlight],
            remarkPlugins: [remarkGfm],
          },
          markdown,
        ),
      );

      const domH1ToH3 = Array.from(container.querySelectorAll("h1, h2, h3")).map((el) => ({
        id: el.id,
        level: Number(el.tagName.slice(1)),
      }));

      expect(tocHeadings.map((item) => ({ id: item.id, level: item.level }))).toEqual(domH1ToH3);
      expect(tocHeadings).toEqual([
        { id: "使用-useswr-请求", text: "使用 useSWR 请求", level: 2 },
        { id: "双反引号-ab-边界", text: "双反引号 a`b 边界", level: 3 },
        { id: "结合-加粗斜体-与-删除线", text: "结合 加粗、斜体 与 删除线", level: 2 },
        { id: "参考-useswr-文档-与-badge", text: "参考 useSWR 文档 与 Badge", level: 3 },
        { id: "图标-架构图-展示", text: "图标 架构图 展示", level: 2 },
        { id: "转义-标题与-c-语言", text: "转义 # 标题与 C# 语言", level: 2 },
        { id: "四级同名标题-2", text: "四级同名标题", level: 2 },
        { id: "使用-useswr-请求-2", text: "使用 useSWR 请求", level: 2 },
        { id: "section", text: "🎉", level: 2 },
        { id: "section-2", text: "🚀", level: 2 },
      ]);
    });

    test("avoids duplicate IDs even when an explicit suffixed heading precedes duplicates", () => {
      const slugger = createHeadingSlugger();
      expect(slugifyHeading("🚀 快速开始")).toBe("快速开始");
      expect(slugger.slug("foo-2")).toBe("foo-2");
      expect(slugger.slug("foo")).toBe("foo");
      expect(slugger.slug("foo")).toBe("foo-3");
    });

    test("extractHeadingText handles nested React elements, numbers, booleans, and null safely", () => {
      const node: ReactNode = [
        "第 ",
        2,
        " 章：",
        React.createElement("strong", { key: "b" }, React.createElement("code", null, "useSWR")),
        false,
        null,
      ];
      expect(extractHeadingText(node)).toBe("第 2 章：useSWR");
    });
  });

  describe("classifyMarkdownLink", () => {
    test("classifies external http/https and protocol-relative links with safe target and rel", () => {
      expect(classifyMarkdownLink("https://example.com/docs")).toEqual({
        kind: "external",
        href: "https://example.com/docs",
        target: "_blank",
        rel: "noopener noreferrer",
      });
      expect(classifyMarkdownLink("http://example.com")).toEqual({
        kind: "external",
        href: "http://example.com",
        target: "_blank",
        rel: "noopener noreferrer",
      });
      expect(classifyMarkdownLink("//cdn.example.com/asset.js")).toEqual({
        kind: "external",
        href: "//cdn.example.com/asset.js",
        target: "_blank",
        rel: "noopener noreferrer",
      });
    });

    test("classifies single-slash relative paths as internal and excludes // or /\\", () => {
      expect(classifyMarkdownLink("/posts/hello-world")).toEqual({
        kind: "internal",
        href: "/posts/hello-world",
      });
      expect(classifyMarkdownLink("/guides?topic=swr#cache")).toEqual({
        kind: "internal",
        href: "/guides?topic=swr#cache",
      });
      expect(classifyMarkdownLink("/\\evil.example.com")).toEqual({
        kind: "unsafe",
      });
    });

    test("classifies hash anchors and mailto links as same-tab safe anchors", () => {
      expect(classifyMarkdownLink("#section-1")).toEqual({
        kind: "anchor",
        href: "#section-1",
      });
      expect(classifyMarkdownLink("mailto:team@inkforge.example")).toEqual({
        kind: "anchor",
        href: "mailto:team@inkforge.example",
      });
    });

    test("neutralizes javascript:, vbscript:, data:, control-char obfuscated schemes, and empty hrefs", () => {
      expect(classifyMarkdownLink("javascript:alert(1)")).toEqual({ kind: "unsafe" });
      expect(classifyMarkdownLink("  JaVaScRiPt:alert(1)  ")).toEqual({ kind: "unsafe" });
      expect(classifyMarkdownLink("java\n\tscript:alert(1)")).toEqual({ kind: "unsafe" });
      expect(classifyMarkdownLink("vbscript:msgbox(1)")).toEqual({ kind: "unsafe" });
      expect(classifyMarkdownLink("data:text/html,<script>alert(1)</script>")).toEqual({ kind: "unsafe" });
      expect(classifyMarkdownLink("")).toEqual({ kind: "unsafe" });
      expect(classifyMarkdownLink("   ")).toEqual({ kind: "unsafe" });
      expect(classifyMarkdownLink(undefined)).toEqual({ kind: "unsafe" });
      expect(classifyMarkdownLink(null)).toEqual({ kind: "unsafe" });
    });
  });
});
