import { act, render, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetcher: vi.fn(),
  apiMutate: vi.fn(),
  globalError: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/client-api", () => ({
  apiFetcher: mocks.apiFetcher,
  apiMutate: mocks.apiMutate,
  handleGlobalSwrError: mocks.globalError,
}));

import { AiTaskActivitySync } from "../AiTaskActivitySync";

function renderSync(activeTaskCount: number) {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        errorRetryCount: 0,
      }}
    >
      <AiTaskActivitySync activeTaskCount={activeTaskCount} observedTaskIds={["task-1"]} />
    </SWRConfig>,
  );
}

/** 冲刷挂载后的首次轮询与定时器回调产生的异步工作。 */
async function flushAsyncWork() {
  await act(async () => {
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
    }
    vi.advanceTimersByTime(0);
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
    }
  });
}

describe("AiTaskActivitySync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiFetcher.mockResolvedValue({ success: true, data: { active: true, tasks: [] } });
    mocks.apiMutate.mockResolvedValue({ success: true, data: { resumedBatchTasks: 1, resumedSummaryJobs: 0 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("triggers explicit POST resume and polls pure read-only GET snapshot URLs without resume=1", async () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    mocks.apiFetcher.mockRejectedValueOnce(error);

    renderSync(1);

    await waitFor(() => {
      expect(mocks.apiFetcher).toHaveBeenCalledTimes(2);
    });

    expect(mocks.apiMutate).toHaveBeenCalledWith("/api/admin/ai/tasks/resume", {
      method: "POST",
      body: JSON.stringify({ taskIds: ["task-1"], includeSummaryJobs: true }),
    });
    expect(mocks.apiFetcher).toHaveBeenNthCalledWith(1, "/api/admin/posts/summarize/bulk");
    expect(mocks.apiFetcher).toHaveBeenNthCalledWith(2, "/api/admin/ai/batch?taskId=task-1");
    for (const [url] of mocks.apiFetcher.mock.calls) {
      expect(String(url)).not.toContain("resume=1");
    }
    expect(mocks.globalError).toHaveBeenCalledWith(error, "/api/admin/posts/summarize/bulk");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  test("triggers one-time mount POST resume when activeTaskCount is 0 and stays idle when resumed count is 0", async () => {
    mocks.apiMutate.mockResolvedValueOnce({
      success: true,
      data: { resumedBatchTasks: 0, resumedSummaryJobs: 0 },
    });

    renderSync(0);

    await waitFor(() => {
      expect(mocks.apiMutate).toHaveBeenCalledTimes(1);
    });
    expect(mocks.apiMutate).toHaveBeenCalledWith("/api/admin/ai/tasks/resume", {
      method: "POST",
      body: JSON.stringify({ taskIds: [], includeSummaryJobs: true }),
    });
    expect(mocks.apiFetcher).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("switches to fast polling when initialActiveCount is 0 on page 1 but POST resume recovers older off-page tasks", async () => {
    vi.useFakeTimers();
    mocks.apiMutate.mockResolvedValueOnce({
      success: true,
      data: { resumedBatchTasks: 1, resumedSummaryJobs: 0 },
    });
    mocks.apiFetcher.mockImplementation(async (url: string) => ({
      success: true,
      data: url.includes("/ai/batch")
        ? { active: true, tasks: [{ id: "task-page-2", status: "RUNNING", counts: { running: 1 }, version: "v1" }] }
        : { active: false, counts: {} },
    }));

    renderSync(0);
    await flushAsyncWork();

    expect(mocks.apiMutate).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetcher).toHaveBeenCalledWith("/api/admin/posts/summarize/bulk");
    expect(mocks.apiFetcher).toHaveBeenCalledWith("/api/admin/ai/batch?includeActive=1&taskId=task-1");
    expect(mocks.refresh).toHaveBeenCalledTimes(2);

    // Fast polling interval is 2500ms (much faster than 10000ms)
    mocks.apiFetcher.mockResolvedValue({
      success: true,
      data: { active: false, tasks: [], counts: {} },
    });
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(3);
  });

  test("refreshes only when the polled task status changes without repeating POST resume on poll ticks", async () => {
    vi.useFakeTimers();
    mocks.apiFetcher.mockResolvedValue({
      success: true,
      data: { active: true, counts: { queued: 1, running: 1 } },
    });

    renderSync(1);
    await flushAsyncWork();

    expect(mocks.apiMutate).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.apiMutate).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);

    mocks.apiFetcher.mockResolvedValue({
      success: true,
      data: { active: true, counts: { queued: 0, running: 1, succeeded: 1 } },
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(4);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(4);
  });

  test("sees the final batch completion once and stops both polling timers", async () => {
    vi.useFakeTimers();
    mocks.apiFetcher.mockImplementation(async (url: string) => ({
      success: true,
      data: url.includes("/ai/batch")
        ? { active: true, tasks: [{ id: "task-1", status: "RUNNING", counts: { running: 1 }, version: "v1" }] }
        : { active: false, counts: {} },
    }));
    renderSync(1);
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);

    mocks.apiFetcher.mockResolvedValue({
      success: true,
      data: { active: false, tasks: [{ id: "task-1", status: "SUCCEEDED", counts: { succeeded: 1 }, version: "v2" }], responseTime: "ignored" },
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(3);

    const calls = mocks.apiFetcher.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    await flushAsyncWork();
    expect(mocks.apiFetcher).toHaveBeenCalledTimes(calls);
  });
});
