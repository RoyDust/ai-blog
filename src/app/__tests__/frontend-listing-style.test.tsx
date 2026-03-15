import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PostCard } from "@/components/blog/PostCard";

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.fill;
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

  const titleRow = container.querySelector("a.group .inline-flex");
  const titleText = container.querySelector("a.group .line-clamp-2");
  const excerpt = container.querySelector(".text-75");
  const absoluteChevron = container.querySelector("svg.absolute");

  expect(titleRow?.className).toContain("inline-flex");
  expect(titleRow?.className).toContain("items-start");
  expect(titleText?.className).toContain("line-clamp-2");
  expect(excerpt?.className).toContain("line-clamp-2");
  expect(absoluteChevron).toBeNull();
});
import React from "react";
