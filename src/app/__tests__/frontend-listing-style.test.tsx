import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { PostCard } from "@/components/blog/PostCard";

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
