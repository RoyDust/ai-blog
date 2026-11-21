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
    expect(rail.className).toContain("transition-[top]");
    expect(rail.className).toContain("will-change-[top]");
    expect(rail.className).not.toContain("transform");
    expect(screen.getByTestId("toc-reload-skeleton")).toBeInTheDocument();

    expect(await screen.findByRole("link", { name: "Intro" })).toHaveAttribute("href", "#intro");
    expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute("href", "#details");
    expect(container.querySelector('[data-state="content"]')).toBeInTheDocument();
  });

  test("uses a serif 目录 title without the english kicker or a panel", () => {
    render(<ArticleTocRail headings={[{ id: "intro", text: "Intro", level: 2 }]} />);

    expect(screen.getByRole("heading", { name: "目录" }).className).toContain("ed-serif");
    expect(screen.queryByText("On this page")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "本文目录" }).className).not.toContain("reader-panel");
  });
});
