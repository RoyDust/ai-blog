import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArticleTocRail } from "../ArticleTocRail";

describe("ArticleTocRail", () => {
  test("reloads the toc in place from a skeleton instead of sliding horizontally", async () => {
    const { container } = render(
      <ArticleTocRail
        headings={[
          { id: "intro", text: "Intro", level: 1 },
          { id: "details", text: "Details", level: 2 },
        ]}
      />,
    );

    const rail = screen.getByTestId("toc-rail");
    expect(rail.className).toContain("transition-[top,box-shadow]");
    expect(rail.className).toContain("will-change-[top]");
    expect(rail.className).not.toContain("transform");
    expect(screen.getByTestId("toc-reload-skeleton")).toBeInTheDocument();

    expect(await screen.findByRole("link", { name: "Intro" })).toHaveAttribute("href", "#intro");
    expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute("href", "#details");
    expect(container.querySelector('[data-state="content"]')).toBeInTheDocument();
  });
});
