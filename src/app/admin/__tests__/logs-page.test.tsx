import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/admin/logs/ApiOperationLogsClient", () => ({
  ApiOperationLogsClient: () => <div data-testid="api-operation-logs-client" />,
}));

describe("admin API operation logs page", () => {
  test("renders the logs workspace", async () => {
    const { default: AdminApiOperationLogsPage } = await import("../logs/page");

    render(<AdminApiOperationLogsPage />);

    expect(screen.getByRole("heading", { name: "接口日志" })).toBeInTheDocument();
    expect(screen.getByText("查看后台、公开接口、AI 客户端和定时任务的请求结果、耗时、调用方与错误摘要。")).toBeInTheDocument();
    expect(screen.getByTestId("api-operation-logs-client")).toBeInTheDocument();
  });
});
