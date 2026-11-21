import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { apiMutate } from "@/lib/client-api";

import { NewsletterForm } from "../NewsletterForm";

vi.mock("@/lib/client-api", () => ({
  apiMutate: vi.fn(),
  toErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const apiMutateMock = vi.mocked(apiMutate);

describe("NewsletterForm", () => {
  beforeEach(() => {
    apiMutateMock.mockReset();
  });

  test("validates email before subscribing", async () => {
    render(<NewsletterForm />);

    fireEvent.change(screen.getByLabelText("邮箱地址"), { target: { value: "not-an-email" } });
    fireEvent.submit(screen.getByRole("button", { name: "订阅" }).closest("form")!);

    const error = await screen.findByText("请输入有效的邮箱地址");
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveAttribute("id", "newsletter-email-error");
    expect(error).toHaveClass("text-[var(--danger-foreground)]");
    const input = screen.getByLabelText("邮箱地址");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "newsletter-email-error");
    expect(apiMutateMock).not.toHaveBeenCalled();
  });

  test("renders the editorial band with a primary button and RSS link by default", () => {
    render(<NewsletterForm />);

    expect(screen.getByRole("region", { name: "订阅 Newsletter" })).toBeInTheDocument();
    expect(screen.getByText("每周一封，精选文章与 AI 日报摘要。")).toHaveClass("ed-serif");
    expect(screen.getByLabelText("邮箱地址")).toHaveClass("ed-input");
    expect(screen.getByLabelText("邮箱地址")).not.toHaveAttribute("aria-invalid");
    const button = screen.getByRole("button", { name: "订阅" });
    expect(button).toHaveClass("ed-btn");
    expect(button).not.toHaveClass("ed-btn-outline");
    expect(screen.getByRole("link", { name: "RSS 订阅" })).toHaveAttribute("href", "/rss.xml");
  });

  test("uses an outline button, custom pitch and no RSS link when configured", () => {
    render(<NewsletterForm buttonVariant="outline" pitch="喜欢这篇？订阅更新。" showRss={false} />);

    const button = screen.getByRole("button", { name: "订阅" });
    expect(button).toHaveClass("ed-btn-outline");
    expect(button).not.toHaveClass("ed-btn");
    expect(screen.getByText("喜欢这篇？订阅更新。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "RSS 订阅" })).not.toBeInTheDocument();
  });

  test("subscribes through apiMutate and shows success feedback", async () => {
    apiMutateMock.mockResolvedValue({ success: true });

    render(<NewsletterForm />);

    fireEvent.change(screen.getByLabelText("邮箱地址"), { target: { value: "reader@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "订阅" }).closest("form")!);

    await waitFor(() => {
      expect(apiMutateMock).toHaveBeenCalledWith(
        "/api/newsletter/subscribe",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "reader@example.com" }),
        }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("订阅请求已提交，请检查邮箱完成确认。");
  });

  test("shows request errors as user feedback", async () => {
    apiMutateMock.mockRejectedValue(new Error("该邮箱已经订阅"));

    render(<NewsletterForm />);

    fireEvent.change(screen.getByLabelText("邮箱地址"), { target: { value: "reader@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "订阅" }).closest("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("该邮箱已经订阅");
    expect(alert).toHaveClass("text-[var(--danger-foreground)]");
  });
});
