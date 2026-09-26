import { act, render, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetcher: vi.fn(),
  globalError: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/client-api", () => ({
  apiFetcher: mocks.apiFetcher,
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("keeps legacy recovery on independent URLs until the worker migration and forwards authentication errors", async () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    mocks.apiFetcher.mockRejectedValueOnce(error);

    renderSync(1);

    await waitFor(() => {
      expect(mocks.apiFetcher).toHaveBeenCalledTimes(2);
    });

    expect(mocks.apiFetcher).toHaveBeenNthCalledWith(
      1,
      "/api/admin/posts/summarize/bulk?resume=1",
    );
    expect(mocks.apiFetcher).toHaveBeenNthCalledWith(2, "/api/admin/ai/batch?resume=1&taskId=task-1");
    expect(mocks.globalError).toHaveBeenCalledWith(error, "/api/admin/posts/summarize/bulk?resume=1");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  test("does not resume tasks when none are active", async () => {
    renderSync(0);

    await Promise.resolve();

    expect(mocks.apiFetcher).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("refreshes only when the polled task status changes", async () => {
    vi.useFakeTimers();
    mocks.apiFetcher.mockResolvedValue({
      success: true,
      data: { active: true, counts: { queued: 1, running: 1 } },
    });

    renderSync(1);
    await flushAsyncWork();

    // 首次轮询：签名从未知变为 A，刷新一次
    expect(mocks.refresh).toHaveBeenCalledTimes(2);

    // 同一状态再次轮询（10s 后）：状态未变，不刷新
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);

    // 状态计数变化：刷新
    mocks.apiFetcher.mockResolvedValue({
      success: true,
      data: { active: true, counts: { queued: 0, running: 1, succeeded: 1 } },
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(4);

    // 状态稳定后继续轮询：不再刷新
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(4);
  });

  test("sees the final batch completion once and stops both polling timers", async () => {
    vi.useFakeTimers();
    mocks.apiFetcher.mockImplementation(async (url: string) => ({ success: true, data: url.includes("/ai/batch") ? { active: true, tasks: [{ id: "task-1", status: "RUNNING", counts: { running: 1 }, version: "v1" }] } : { active: false, counts: {} } }));
    renderSync(1); await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    mocks.apiFetcher.mockResolvedValue({ success: true, data: { active: false, tasks: [{ id: "task-1", status: "SUCCEEDED", counts: { succeeded: 1 }, version: "v2" }], responseTime: "ignored" } });
    await act(async () => { vi.advanceTimersByTime(10000); }); await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(3);
    const calls = mocks.apiFetcher.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(30000); }); await flushAsyncWork();
    expect(mocks.apiFetcher).toHaveBeenCalledTimes(calls);
  });
});
