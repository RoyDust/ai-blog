import { isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CopyCodeButton } from "./CopyCodeButton";

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  plaintext: "text",
  txt: "text",
};

function extractNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractNodeText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractNodeText(node.props.children);
  }
  return "";
}

function extractLanguageFromNode(node: ReactNode): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = extractLanguageFromNode(child);
      if (found) return found;
    }
    return null;
  }

  if (isValidElement<{ className?: string; children?: ReactNode }>(node)) {
    const className = typeof node.props.className === "string" ? node.props.className : "";
    const match = className.match(/(?:^|\s)language-([a-z0-9_+-]+)/i);
    if (match?.[1]) {
      const raw = match[1].toLowerCase();
      return LANGUAGE_ALIASES[raw] ?? raw;
    }
    return extractLanguageFromNode(node.props.children);
  }

  return null;
}

export function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const code = extractNodeText(children).replace(/\n$/, "");
  const language = extractLanguageFromNode(children) ?? "code";

  return (
    <figure className="code-block-shell not-prose group my-5">
      <figcaption className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <CopyCodeButton code={code} variant="header" />
      </figcaption>
      <pre {...props}>{children}</pre>
    </figure>
  );
}
