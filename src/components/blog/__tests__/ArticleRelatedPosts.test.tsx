import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArticleRelatedPosts } from "../ArticleRelatedPosts";

describe("ArticleRelatedPosts", () => {
  test("does not render an empty related-post section", () => {
    const { container } = render(<ArticleRelatedPosts posts={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  test("renders compact links for related posts", () => {
    render(
      <ArticleRelatedPosts
        posts={[
          {
            id: "related-1",
            title: "Related article",
            slug: "related-article",
            excerpt: "A related excerpt",
            createdAt: "2026-03-01T00:00:00.000Z",
            category: { name: "Tech", slug: "tech" },
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "相关文章" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Related article/ })).toHaveAttribute("href", "/posts/related-article");
    expect(screen.getByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("A related excerpt")).toBeInTheDocument();
  });
});
