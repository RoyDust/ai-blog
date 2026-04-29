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
