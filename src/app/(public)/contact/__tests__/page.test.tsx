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

    const { container } = render(<ContactPage />);

    expect(screen.getByRole("heading", { level: 1, name: "联系我" })).toBeInTheDocument();
    expect(screen.getByText("联系", { selector: ".ed-eyebrow" })).toBeInTheDocument();
    expect(screen.getByLabelText(/邮箱/)).toBeInTheDocument();
    expect(screen.getByLabelText(/主题/)).toBeInTheDocument();
    expect(screen.getByLabelText(/内容/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送邮件" })).toBeInTheDocument();
    const notes = screen.getByRole("complementary", { name: "联系说明" });
    expect(notes).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "适合发来的内容" })).toBeInTheDocument();
    // 「适合发来的内容」挪到表单下方，是细线列表而不是右侧面板
    const form = container.querySelector("form");
    expect(form?.compareDocumentPosition(notes)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(notes.querySelectorAll("li.border-b")).toHaveLength(2);
    expect(container.querySelector(".reader-panel, svg")).toBeNull();
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
