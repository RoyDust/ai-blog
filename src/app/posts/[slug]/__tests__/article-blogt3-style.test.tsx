import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { ArticleToc } from "@/components/blog/ArticleToc";

test("article toc uses blogt3 text token styles", () => {
  const { getByRole } = render(
    <ArticleToc headings={[{ id: "intro", text: "Intro", level: 1 }]} />
  );

  expect(getByRole("link").className).toContain("text-75");
});
