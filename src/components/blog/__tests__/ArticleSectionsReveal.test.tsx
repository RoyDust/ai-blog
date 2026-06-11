import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArticleSection } from "../ArticleSectionsReveal";
import { InViewReveal } from "@/components/motion";

describe("article section motion containers", () => {
  test("ArticleSection 独立携带加载入场并渲染 children", () => {
    const { container } = render(
      <ArticleSection animate="visible" initial="hidden">
        <p>section A</p>
      </ArticleSection>,
    );

    expect(screen.getByText("section A")).toBeInTheDocument();
    expect(container.querySelector("section")).not.toBeNull();
  });

  test("InViewReveal 渲染 section 容器并保留可访问属性", () => {
    const { container } = render(
      <InViewReveal aria-labelledby="x-heading" className="reader-panel" id="x">
        <p>section B</p>
      </InViewReveal>,
    );

    const section = container.querySelector("section");
    expect(screen.getByText("section B")).toBeInTheDocument();
    expect(section).toHaveAttribute("id", "x");
    expect(section).toHaveAttribute("aria-labelledby", "x-heading");
  });
});
