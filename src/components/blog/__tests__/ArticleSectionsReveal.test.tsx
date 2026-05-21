import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArticleSection, ArticleSectionsReveal } from "../ArticleSectionsReveal";

describe("ArticleSectionsReveal", () => {
  test("renders children inside the reveal container", () => {
    render(
      <ArticleSectionsReveal>
        <ArticleSection>
          <p>section A</p>
        </ArticleSection>
        <ArticleSection>
          <p>section B</p>
        </ArticleSection>
      </ArticleSectionsReveal>,
    );

    expect(screen.getByText("section A")).toBeInTheDocument();
    expect(screen.getByText("section B")).toBeInTheDocument();
  });
});
