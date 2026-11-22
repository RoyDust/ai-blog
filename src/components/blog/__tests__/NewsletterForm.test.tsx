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

    expect(await screen.findByText("请输入有效的邮箱地址")).toBeInTheDocument();
    expect(apiMutateMock).not.toHaveBeenCalled();
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

    expect(await screen.findByRole("alert")).toHaveTextContent("该邮箱已经订阅");
  });
});
