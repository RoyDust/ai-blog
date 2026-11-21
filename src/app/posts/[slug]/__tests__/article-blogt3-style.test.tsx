import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ArticleToc } from "@/components/blog/ArticleToc";

const headings = [
  { id: "intro", text: "Intro", level: 2 as const },
  { id: "intro-detail", text: "Intro detail", level: 3 as const },
  { id: "deep", text: "Deep", level: 2 as const },
  { id: "deep-detail", text: "Deep detail", level: 3 as const },
];

const mounted: HTMLElement[] = [];

afterEach(() => {
  mounted.splice(0).forEach((element) => element.remove());
});

function mountHeadings(tops: Record<string, number>) {
  for (const [id, top] of Object.entries(tops)) {
    const element = document.createElement("h2");
    element.id = id;
    element.getBoundingClientRect = () => ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON: () => ({}) });
    element.scrollIntoView = vi.fn();
    document.body.appendChild(element);
    mounted.push(element);
  }
}

test("article toc draws a 1px rail and marks the current section with aria-current", async () => {
  mountHeadings({ intro: -400, "intro-detail": -200, deep: 40, "deep-detail": 600 });
  const { container } = render(<ArticleToc headings={headings} />);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  expect(container.querySelector("ul")?.className).toContain("article-toc__list");
  const active = screen.getByRole("link", { name: "Deep" });
  expect(active).toHaveAttribute("aria-current", "location");
  expect(active.querySelector(".article-toc__indicator")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Intro" })).not.toHaveAttribute("aria-current");
});

test("article toc only expands h3 entries under the active h2 and indents by level", async () => {
  mountHeadings({ intro: 10, "intro-detail": 400, deep: 800, "deep-detail": 1200 });
  render(<ArticleToc headings={headings} />);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  expect(screen.getByRole("link", { name: "Intro detail" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Deep detail" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Intro" }).getAttribute("style")).toContain("--toc-indent: 0.75rem");
  expect(screen.getByRole("link", { name: "Intro detail" }).getAttribute("style")).toContain("--toc-indent: 1.375rem");
});

test("article toc scrolls to the heading and reports navigation", () => {
  mountHeadings({ target: 900 });
  const onNavigate = vi.fn();
  render(<ArticleToc headings={[{ id: "target", text: "Target", level: 2 }]} onNavigate={onNavigate} />);

  fireEvent.click(screen.getByRole("link", { name: "Target" }));

  expect(onNavigate).toHaveBeenCalledWith("target");
  expect(document.getElementById("target")?.scrollIntoView).toHaveBeenCalled();
});
