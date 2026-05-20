import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { buildContactMailto, ContactForm } from "../ContactForm";

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

describe("ContactForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  });

  test("builds a mailto URL with sender context", () => {
    const href = buildContactMailto("hello@example.com", {
      name: "Roy",
      email: "reader@example.com",
      subject: "合作",
      message: "这是一段超过二十个字的联系内容，用于测试提交。",
    });

    expect(href).toContain("mailto:hello@example.com");
    expect(decodeURIComponent(href)).toContain("subject=合作");
    expect(decodeURIComponent(href)).toContain("姓名：Roy");
    expect(decodeURIComponent(href)).toContain("邮箱：reader@example.com");
  });

  test("validates required fields before opening the mail client", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ContactForm />);
    fireEvent.click(screen.getByRole("button", { name: "发送邮件" }));

    expect(await screen.findByText("请输入有效的邮箱地址")).toBeInTheDocument();
    expect(screen.getByText("主题至少 2 个字")).toBeInTheDocument();
    expect(screen.getByText("内容至少 20 个字")).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  test("opens the local mail client after valid submission", async () => {
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = "hello@example.com";
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: "Roy" } });
    fireEvent.change(screen.getByLabelText(/邮箱/), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText(/主题/), { target: { value: "合作" } });
    fireEvent.change(screen.getByLabelText(/内容/), {
      target: { value: "这是一段超过二十个字的联系内容，用于测试提交。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送邮件" }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("mailto:hello@example.com"), "_self");
    });
    expect(toastMocks.success).toHaveBeenCalledWith("已打开邮件客户端，请发送邮件。");
  });
});
