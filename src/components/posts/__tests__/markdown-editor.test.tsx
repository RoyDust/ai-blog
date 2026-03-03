import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MarkdownEditor } from "@/components/posts/MarkdownEditor";

describe("markdown editor", () => {
  test("renders source editor and live preview", () => {
    const onChange = vi.fn();

    const { container } = render(
      <MarkdownEditor
        label="内容"
        value={"# 标题\n\n**bold**"}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText("内容")).toBeInTheDocument();
    expect(screen.getByText("实时预览")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(container.querySelector(".prose")?.className).toContain("prose-pre:rounded-xl");
  });
});
