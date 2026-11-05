import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArticleRelatedPosts } from "../ArticleRelatedPosts";

describe("ArticleRelatedPosts", () => {
  test("does not render an empty related-post section", () => {
    const { container } = render(<ArticleRelatedPosts posts={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  test("renders cover columns with serif titles and category · date meta", () => {
    const { container } = render(
      <ArticleRelatedPosts
        posts={[
          {
            id: "related-1",
            title: "Related article",
            slug: "related-article",
            excerpt: "A related excerpt",
            coverImage: "https://example.com/cover.jpg",
            createdAt: "2026-03-01T00:00:00.000Z",
            category: { name: "Tech", slug: "tech" },
          },
          {
            id: "related-2",
            title: "No cover article",
            slug: "no-cover",
            createdAt: "2026-02-01T00:00:00.000Z",
            category: { name: "Design", slug: "design" },
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "相关文章" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Related article/ });
    expect(link).toHaveAttribute("href", "/posts/related-article");
    expect(link).toHaveTextContent("Tech");
    expect(link).toHaveTextContent("2026-03-01");
    expect(link.querySelector("img")).toBeInTheDocument();
    expect(screen.queryByText("A related excerpt")).not.toBeInTheDocument();

    const placeholder = container.querySelector(".article-related__placeholder");
    expect(placeholder).toHaveTextContent("Design");
    expect(container.querySelector(".reader-chip")).toBeNull();
  });
});
