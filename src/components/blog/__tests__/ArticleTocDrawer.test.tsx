import { render, screen } from "@testing-library/react";
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
});
