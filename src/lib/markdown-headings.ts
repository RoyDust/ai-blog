import { isValidElement, type ReactNode } from "react";

export interface MarkdownHeadingItem {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

export interface HeadingSlugger {
  slug: (text: string) => string;
  reset: () => void;
}

export type ClassifiedMarkdownLink =
  | {
      kind: "external";
      href: string;
      target: "_blank";
      rel: "noopener noreferrer";
    }
  | {
      kind: "internal";
      href: string;
    }
  | {
      kind: "anchor";
      href: string;
    }
  | {
      kind: "unsafe";
    };

interface ActiveFence {
  char: "`" | "~";
  length: number;
}

const CODE_TOKEN_START = "\uE000";
const CODE_TOKEN_END = "\uE001";
const ESCAPE_TOKEN_START = "\uE002";
const ESCAPE_TOKEN_END = "\uE003";

/**
 * CommonMark 6.1：扫描并保护行内代码片段（支持单反引号与多反引号 `` ``a`b`` ``），
 * 防止代码块内的 `_`、`*`、`[...](...)`、`\#` 被后续规则误剥离。
 */
function tokenizeInlineCode(input: string, codeTokens: string[]): string {
  let result = "";
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char === "\\" && index + 1 < input.length) {
      result += input.slice(index, index + 2);
      index += 2;
      continue;
    }

    if (char !== "`") {
      result += char;
      index += 1;
      continue;
    }

    let openLength = 0;
    while (index + openLength < input.length && input[index + openLength] === "`") {
      openLength += 1;
    }

    let cursor = index + openLength;
    let closingIndex = -1;

    while (cursor < input.length) {
      if (input[cursor] !== "`") {
        cursor += 1;
        continue;
      }

      let runLength = 0;
      while (cursor + runLength < input.length && input[cursor + runLength] === "`") {
        runLength += 1;
      }

      if (runLength === openLength) {
        closingIndex = cursor;
        break;
      }

      cursor += runLength;
    }

    if (closingIndex === -1) {
      result += "`".repeat(openLength);
      index += openLength;
      continue;
    }

    let rawCode = input.slice(index + openLength, closingIndex).replace(/\r?\n/g, " ");
    if (
      rawCode.length >= 2 &&
      rawCode.startsWith(" ") &&
      rawCode.endsWith(" ") &&
      rawCode.trim().length > 0
    ) {
      rawCode = rawCode.slice(1, -1);
    }

    const tokenIndex = codeTokens.push(rawCode) - 1;
    result += `${CODE_TOKEN_START}${tokenIndex}${CODE_TOKEN_END}`;
    index = closingIndex + openLength;
  }

  return result;
}

/**
 * 扫描 `[label](destination "title")` 中从 `(` 开始的链接目标，支持平衡括号、尖括号 URL 与引号 title。
 * 返回匹配的右括号索引；不合法或未闭合时返回 -1。
 */
function findClosingLinkParen(input: string, openParenIndex: number): number {
  let cursor = openParenIndex + 1;
  while (cursor < input.length && (input[cursor] === " " || input[cursor] === "\t")) {
    cursor += 1;
  }

  if (cursor < input.length && input[cursor] === ")") {
    return cursor;
  }

  if (cursor < input.length && input[cursor] === "<") {
    cursor += 1;
    while (cursor < input.length && input[cursor] !== ">") {
      if (input[cursor] === "<" || input[cursor] === "\n") {
        return -1;
      }
      cursor += 1;
    }
    if (cursor >= input.length) {
      return -1;
    }
    cursor += 1;
  }

  let parenDepth = 1;
  let activeQuote: '"' | "'" | null = null;

  while (cursor < input.length) {
    const ch = input[cursor];

    if (activeQuote) {
      if (ch === activeQuote) {
        activeQuote = null;
      }
      cursor += 1;
      continue;
    }

    if ((ch === '"' || ch === "'") && (input[cursor - 1] === " " || input[cursor - 1] === "\t")) {
      activeQuote = ch;
      cursor += 1;
      continue;
    }

    if (ch === "(") {
      parenDepth += 1;
    } else if (ch === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        return cursor;
      }
    }

    cursor += 1;
  }

  return -1;
}

function findMatchingClosingBracket(input: string, openBracketIndex: number): number {
  let depth = 1;
  for (let cursor = openBracketIndex + 1; cursor < input.length; cursor += 1) {
    if (input[cursor] === "[") {
      depth += 1;
    } else if (input[cursor] === "]") {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }
  }
  return -1;
}

/**
 * 剥离 Markdown 图片 `![alt](url)` -> `alt` 或链接 `[label](url "title")` -> `label`（含引用式 `[label][ref]`）。
 */
function stripBracketConstructs(input: string, mode: "image" | "link"): string {
  let result = "";
  let index = 0;

  while (index < input.length) {
    const isImageStart = input[index] === "!" && input[index + 1] === "[";
    const isLinkStart = input[index] === "[" && (index === 0 || input[index - 1] !== "!");

    if ((mode === "image" && !isImageStart) || (mode === "link" && !isLinkStart)) {
      result += input[index];
      index += 1;
      continue;
    }

    const openBracketIndex = mode === "image" ? index + 1 : index;
    const closeBracketIndex = findMatchingClosingBracket(input, openBracketIndex);

    if (closeBracketIndex === -1) {
      result += input[index];
      index += 1;
      continue;
    }

    const label = input.slice(openBracketIndex + 1, closeBracketIndex);
    const nextIndex = closeBracketIndex + 1;

    if (input[nextIndex] === "(") {
      const closeParenIndex = findClosingLinkParen(input, nextIndex);
      if (closeParenIndex !== -1) {
        result += label;
        index = closeParenIndex + 1;
        continue;
      }
    } else if (input[nextIndex] === "[") {
      const closeRefIndex = input.indexOf("]", nextIndex + 1);
      if (closeRefIndex !== -1 && !input.slice(nextIndex + 1, closeRefIndex).includes("[")) {
        result += label;
        index = closeRefIndex + 1;
        continue;
      }
    }

    result += input[index];
    index += 1;
  }

  return result;
}

/**
 * 剥离 CommonMark ATX 标题行尾可选的闭合 `#` 序列（如 `## Title ##` -> `Title`），
 * 保留非空白前导的 `## C#` 以及转义的 `## Title \#`。
 */
export function stripTrailingAtxHashes(rawHeading: string): string {
  const trimmedRight = rawHeading.replace(/[ \t]+$/, "");
  if (/^#+$/.test(trimmedRight)) {
    return "";
  }
  return trimmedRight.replace(/[ \t]+#+$/, "");
}

/**
 * 剥离标题中的行内 Markdown 语法，使 TOC 展示文本与 ReactMarkdown 渲染出的纯文本完全一致。
 */
export function stripInlineMarkdown(input: string): string {
  if (!input) {
    return "";
  }

  const codeTokens: string[] = [];
  const escapeTokens: string[] = [];

  // 1. 保护行内代码片段
  let text = tokenizeInlineCode(input, codeTokens);

  // 2. 保护反斜杠转义标点（如 \#、\*、\[、\)）
  text = text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, (_, escapedChar: string) => {
    const tokenIndex = escapeTokens.push(escapedChar) - 1;
    return `${ESCAPE_TOKEN_START}${tokenIndex}${ESCAPE_TOKEN_END}`;
  });

  // 3. 先剥离图片，再剥离链接（兼容 [![badge](img)](url) 等嵌套结构）
  for (let pass = 0; pass < 3; pass += 1) {
    const prev = text;
    text = stripBracketConstructs(text, "image");
    text = stripBracketConstructs(text, "link");
    if (text === prev) {
      break;
    }
  }

  // 4. 剥离尖括号自动链接
  text = text.replace(/<((?:https?|ftp):\/\/[^\s<>]+)>/gi, "$1");
  text = text.replace(
    /<(?:mailto:)?([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)>/g,
    "$1",
  );

  // 5. 剥离加粗、斜体与删除线（下划线遵循 CommonMark 词内不触发规则，保留 snake_case）
  for (let pass = 0; pass < 4; pass += 1) {
    const prev = text;
    text = text
      .replace(/~~([^\s~](?:.*?[^\s~])?)~~/g, "$1")
      .replace(/\*\*\*([^\s*](?:.*?[^\s*])?)\*\*\*/g, "$1")
      .replace(/\*\*([^\s*](?:.*?[^\s*])?)\*\*/g, "$1")
      .replace(/\*([^\s*](?:.*?[^\s*])?)\*/g, "$1")
      .replace(/(?<![\p{L}\p{N}_])___([^\s_](?:.*?[^\s_])?)___(?![\p{L}\p{N}_])/gu, "$1")
      .replace(/(?<![\p{L}\p{N}_])__([^\s_](?:.*?[^\s_])?)__(?![\p{L}\p{N}_])/gu, "$1")
      .replace(/(?<![\p{L}\p{N}_])_([^\s_](?:.*?[^\s_])?)_(?![\p{L}\p{N}_])/gu, "$1");

    if (text === prev) {
      break;
    }
  }

  // 6. 还原转义标点与行内代码原文
  text = text.replace(
    new RegExp(`${ESCAPE_TOKEN_START}(\\d+)${ESCAPE_TOKEN_END}`, "g"),
    (_, idx: string) => escapeTokens[Number(idx)] ?? "",
  );
  text = text.replace(
    new RegExp(`${CODE_TOKEN_START}(\\d+)${CODE_TOKEN_END}`, "g"),
    (_, idx: string) => codeTokens[Number(idx)] ?? "",
  );

  return text;
}

/**
 * 把纯文本标题转为目录锚点可用的基础 slug。
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 创建有状态的标题锚点生成器：同文档内按出现顺序做确定性去重（`id`、`id-2`、`id-3`）。
 */
export function createHeadingSlugger(): HeadingSlugger {
  const counters = new Map<string, number>();
  const usedIds = new Set<string>();

  return {
    slug(text: string): string {
      const baseId = slugifyHeading(text) || "section";
      let count = (counters.get(baseId) ?? 0) + 1;
      let candidate = count === 1 ? baseId : `${baseId}-${count}`;

      while (usedIds.has(candidate)) {
        count += 1;
        candidate = `${baseId}-${count}`;
      }

      counters.set(baseId, count);
      usedIds.add(candidate);
      return candidate;
    },
    reset() {
      counters.clear();
      usedIds.clear();
    },
  };
}

/**
 * 从 ReactMarkdown 标题组件的 `children` 提取纯文本（含内嵌图片的 `alt` 文本），
 * 以便与 `extractHeadings()` 产出完全一致的锚点 ID。
 */
export function extractHeadingText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractHeadingText).join("");
  }

  if (isValidElement<{ children?: ReactNode; alt?: unknown }>(node)) {
    if (node.props.children !== undefined && node.props.children !== null) {
      return extractHeadingText(node.props.children);
    }
    if (typeof node.props.alt === "string") {
      return node.props.alt;
    }
    return "";
  }

  return "";
}

/**
 * 从 Markdown 正文中提取 1–3 级标题供目录组件使用：
 * - 严格跟踪反引号（```` ``` ````+）与波浪线（`~~~`+）围栏代码块状态（允许最多 3 个前导空格，闭合围栏须同字符且长度 >= 开启围栏），忽略块内所有 `# 注释`
 * - 剥离尾部 ATX `#` 与行内 Markdown 语法后再展示并计算锚点 ID
 * - 对 1–6 级 ATX 标题统一推进 `createHeadingSlugger()`，保证与正文 `ReactMarkdown` 渲染标题顺序一致
 */
export function extractHeadings(markdown: string): MarkdownHeadingItem[] {
  const slugger = createHeadingSlugger();
  const headings: MarkdownHeadingItem[] = [];
  let activeFence: ActiveFence | null = null;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.replace(/\r$/, "");

    if (activeFence) {
      const closePattern = activeFence.char === "`" ? /^ {0,3}(`+)[ \t]*$/ : /^ {0,3}(~+)[ \t]*$/;
      const closeMatch = closePattern.exec(line);
      if (closeMatch && closeMatch[1].length >= activeFence.length) {
        activeFence = null;
      }
      continue;
    }

    const backtickFence = /^ {0,3}(`{3,})([^`]*)$/.exec(line);
    if (backtickFence) {
      activeFence = { char: "`", length: backtickFence[1].length };
      continue;
    }

    const tildeFence = /^ {0,3}(~{3,})(.*)$/.exec(line);
    if (tildeFence) {
      activeFence = { char: "~", length: tildeFence[1].length };
      continue;
    }

    const headingMatch = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/.exec(line);
    if (!headingMatch) {
      continue;
    }

    const level = headingMatch[1].length;
    const withoutTrailingHashes = stripTrailingAtxHashes(headingMatch[2] ?? "");
    const text = stripInlineMarkdown(withoutTrailingHashes).trim();
    const id = slugger.slug(text);

    if (level <= 3 && text.length > 0) {
      headings.push({
        id,
        text,
        level: level as 1 | 2 | 3,
      });
    }
  }

  return headings;
}

/**
 * 对 Markdown 链接 href 做安全分类：
 * - `http://`、`https://` 与协议相对 `//` 归为外链（附加 `_blank` + `noopener noreferrer`）
 * - 单斜杠站内相对路径 `/...`（排除 `//` 与 `/\`）归为站内路由（供 Next.js `<Link>` 使用）
 * - `#...` 页内锚点、`mailto:` 及无协议相对路径归为当前页安全链接
 * - 空链接及 `javascript:`、`vbscript:`、`data:` 等危险或未知协议归为 `unsafe`（降级为无 `href` 的 `<span>`）
 */
export function classifyMarkdownLink(rawHref: string | null | undefined): ClassifiedMarkdownLink {
  if (typeof rawHref !== "string") {
    return { kind: "unsafe" };
  }

  const href = rawHref.trim();
  if (!href) {
    return { kind: "unsafe" };
  }

  if (href.startsWith("/\\")) {
    return { kind: "unsafe" };
  }

  if (href.startsWith("//")) {
    return {
      kind: "external",
      href,
      target: "_blank",
      rel: "noopener noreferrer",
    };
  }

  if (href.startsWith("/")) {
    return {
      kind: "internal",
      href,
    };
  }

  const compactHref = href.replace(/[\u0000-\u0020]+/g, "");
  const colonIndex = compactHref.indexOf(":");
  const slashIndex = compactHref.indexOf("/");
  const queryIndex = compactHref.indexOf("?");
  const hashIndex = compactHref.indexOf("#");

  const hasSchemeBeforeDelimiters =
    colonIndex !== -1 &&
    (slashIndex === -1 || colonIndex < slashIndex) &&
    (queryIndex === -1 || colonIndex < queryIndex) &&
    (hashIndex === -1 || colonIndex < hashIndex);

  if (hasSchemeBeforeDelimiters) {
    const scheme = compactHref.slice(0, colonIndex).toLowerCase();
    if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
      return { kind: "unsafe" };
    }

    if (scheme === "http" || scheme === "https") {
      return {
        kind: "external",
        href,
        target: "_blank",
        rel: "noopener noreferrer",
      };
    }

    if (scheme === "mailto") {
      return {
        kind: "anchor",
        href,
      };
    }

    return { kind: "unsafe" };
  }

  return {
    kind: "anchor",
    href,
  };
}
