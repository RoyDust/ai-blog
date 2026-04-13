import React from "react";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PostCard } from "@/components/blog/PostCard";

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean }) => {
    const { fill, ...imageProps } = props;
    return React.createElement("img", { ...imageProps, alt: imageProps.alt ?? "" });
  },
}));

const post = {
  id: "1",
  title: "Test title",
  slug: "test-title",
  excerpt: "Excerpt",
  coverImage: null,
  createdAt: new Date().toISOString(),
  author: { id: "u1", name: "Tester", image: null },
  category: { name: "Tech", slug: "tech" },
  tags: [{ name: "next", slug: "next" }],
  _count: { comments: 1, likes: 2 },
};

test("post card uses blogt3 card shell", () => {
  const { container } = render(<PostCard post={post} />);
  expect(container.firstElementChild?.className).toContain("card-base");
});

test("post card renders chevron inline after title and clamps copy", () => {
  const { container } = render(<PostCard post={{ ...post, coverImage: "http://project.roydust.top/demo.png" }} />);

  const article = container.querySelector("article");
  const excerpt = container.querySelector("p.text-75");
  const coverLink = container.querySelector('a[aria-label="Test title"]');

  expect(article?.className).toContain("md:grid-cols-[minmax(0,1fr)_15rem]");
  expect(excerpt?.className).toContain("line-clamp-3");
  expect(coverLink?.className).toContain("theme-media");
  expect(container.querySelector('[data-testid="post-card-chevron"]')).toBeNull();
});
