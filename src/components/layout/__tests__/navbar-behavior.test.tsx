import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Navbar } from "@/components/layout/Navbar";

test("navbar renders an expanding desktop search field", () => {
  const { container } = render(<Navbar />);

  const desktopSearch = Array.from(container.querySelectorAll('input[type="search"][name="q"]')).find((node) =>
    (node as HTMLInputElement).className.includes("lg:w-40")
  ) as HTMLInputElement | undefined;

  expect(desktopSearch).toBeTruthy();
  expect(desktopSearch?.className).toContain("lg:w-40");
  expect(desktopSearch?.className).toContain("lg:focus:w-64");
  expect(desktopSearch?.closest("form")?.getAttribute("method")).toBe("get");
  expect(container.querySelector('a[href="/archives"]')).toBeTruthy();
  expect(container.querySelector('a[href="/about"]')).toBeTruthy();
  expect(container.querySelector('a[href="/search"]')).toBeTruthy();

  const archiveLink = container.querySelector('a[href="/archives"]') as HTMLAnchorElement | null;
  expect(archiveLink).toBeTruthy();
  expect(archiveLink?.className).toContain('hover:bg-[#E2F0FF]');
  expect(archiveLink?.className).toContain('hover:text-[var(--primary)]');
});
