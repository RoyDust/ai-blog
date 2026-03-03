import { describe, expect, test, vi } from "vitest";
import CategoriesPage from "@/app/(public)/categories/page";
import CategoryPage from "@/app/(public)/categories/[slug]/page";
import TagsPage from "@/app/(public)/tags/page";
import TagPage from "@/app/(public)/tags/[slug]/page";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

describe("taxonomy routes", () => {
  test("/categories redirects to posts", async () => {
    await CategoriesPage();
    expect(redirectMock).toHaveBeenCalledWith("/posts");
  });

  test("/tags redirects to posts", async () => {
    await TagsPage();
    expect(redirectMock).toHaveBeenCalledWith("/posts");
  });

  test("/categories/[slug] redirects to filtered posts", async () => {
    await CategoryPage({ params: Promise.resolve({ slug: "frontend" }) });
    expect(redirectMock).toHaveBeenCalledWith("/posts?category=frontend");
  });

  test("/tags/[slug] redirects to filtered posts", async () => {
    await TagPage({ params: Promise.resolve({ slug: "nextjs" }) });
    expect(redirectMock).toHaveBeenCalledWith("/posts?tag=nextjs");
  });
});
