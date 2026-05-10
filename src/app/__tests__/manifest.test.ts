import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: () =>
    Promise.resolve({
      siteName: "Configured Blog",
      siteDescription: "Configured description",
      siteUrl: "https://blog.example",
      locale: "zh-CN",
    }),
}));

describe("manifest", () => {
  test("uses configured site identity", async () => {
    const { default: manifest } = await import("../manifest");
    const output = await manifest();

    expect(output.name).toBe("Configured Blog");
    expect(output.short_name).toBe("Configured Blog");
    expect(output.description).toBe("Configured description");
  });
});
