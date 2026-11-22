import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

const getBlogSettings = vi.fn(async () => ({
  siteName: "Configured Blog",
  siteDescription: "Configured description",
  siteUrl: "https://blog.example",
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings,
}));

describe("contact page", () => {
  test("renders the contact form as a public landing page", async () => {
    const { default: ContactPage } = await import("../page");

    render(<ContactPage />);

    expect(screen.getByRole("heading", { level: 1, name: "联系我" })).toBeInTheDocument();
    expect(screen.getByLabelText(/邮箱/)).toBeInTheDocument();
    expect(screen.getByLabelText(/主题/)).toBeInTheDocument();
    expect(screen.getByLabelText(/内容/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送邮件" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "联系说明" })).toBeInTheDocument();
  });

  test("generates indexable contact metadata", async () => {
    const { generateMetadata } = await import("../page");

    await expect(generateMetadata()).resolves.toMatchObject({
      title: "联系我",
      alternates: { canonical: "https://blog.example/contact" },
      openGraph: {
        url: "https://blog.example/contact",
        type: "website",
      },
    });
  });
});
