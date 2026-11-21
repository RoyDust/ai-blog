import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { ArticleToc } from "@/components/blog/ArticleToc";

test("article toc uses Night Reader link styles", () => {
  const { getByRole } = render(
    <ArticleToc headings={[{ id: "intro", text: "Intro", level: 1 }]} />
  );

  expect(getByRole("link").className).toContain("reader-link");
  expect(getByRole("link").className).toContain("text-[var(--text-body)]");
});

test("article toc keeps guide markers aligned while indenting text", () => {
  const { container, getAllByRole } = render(
    <ArticleToc
      headings={[
        { id: "intro", text: "Intro", level: 1 },
        { id: "details", text: "Details", level: 2 },
        { id: "deep", text: "Deep", level: 3 },
      ]}
    />
  );

  expect(container.querySelector("ul")?.className).toContain("before:left-1");
  expect(getAllByRole("link").map((link) => link.getAttribute("style"))).toEqual([null, null, null]);
  expect(Array.from(container.querySelectorAll("a > span:last-child")).map((span) => span.getAttribute("style"))).toEqual([
    "padding-left: 0px;",
    "padding-left: 12px;",
    "padding-left: 24px;",
  ]);
});
