import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArticleTocDrawer } from "../ArticleTocDrawer";

describe("ArticleTocDrawer", () => {
  test("does not render when the article has no headings", () => {
    render(<ArticleTocDrawer headings={[]} />);

    expect(screen.queryByRole("button", { name: "打开文章目录" })).not.toBeInTheDocument();
  });

  test("renders a mobile toc trigger when headings exist", () => {
    render(
      <ArticleTocDrawer
        headings={[
          { id: "intro", text: "Intro", level: 1 },
          { id: "details", text: "Details", level: 2 },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "打开文章目录" })).toBeInTheDocument();
  });

  test("renders a bottom-left outline text trigger and opens a sheet with read progress", async () => {
    render(
      <ArticleTocDrawer
        headings={[
          { id: "intro", text: "Intro", level: 2 },
          { id: "details", text: "Details", level: 3 },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "打开文章目录" });
    expect(trigger).toHaveTextContent("目录");
    expect(trigger.className).toContain("ed-btn-outline");
    expect(trigger.className).toContain("left-4");
    expect(trigger.querySelector("svg")).toBeNull();

    fireEvent.click(trigger);

    expect(await screen.findByText("已读", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Intro" })).toHaveAttribute("href", "#intro");
  });
});
