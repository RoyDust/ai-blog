import { act, render, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiMutate: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/client-api", () => ({
  apiMutate: mocks.apiMutate,
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
      <AiTaskActivitySync activeTaskCount={activeTaskCount} />
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
    mocks.apiMutate.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("uses the shared API client for both resume endpoints and refreshes after the first poll", async () => {
    mocks.apiMutate.mockRejectedValueOnce(new Error("summary resume failed"));

    renderSync(1);

    await waitFor(() => {
      expect(mocks.apiMutate).toHaveBeenCalledTimes(2);
    });

    expect(mocks.apiMutate).toHaveBeenNthCalledWith(
      1,
      "/api/admin/posts/summarize/bulk?resume=1",
    );
    expect(mocks.apiMutate).toHaveBeenNthCalledWith(2, "/api/admin/ai/batch?resume=1");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  test("does not resume tasks when none are active", async () => {
    renderSync(0);

    await Promise.resolve();

    expect(mocks.apiMutate).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("refreshes only when the polled task status changes", async () => {
    vi.useFakeTimers();
    mocks.apiMutate.mockResolvedValue({
      success: true,
      data: { active: true, counts: { queued: 1, running: 1 } },
    });

    renderSync(1);
    await flushAsyncWork();

    // 首次轮询：签名从未知变为 A，刷新一次
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    // 同一状态再次轮询（10s 后）：状态未变，不刷新
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    // 状态计数变化：刷新
    mocks.apiMutate.mockResolvedValue({
      success: true,
      data: { active: true, counts: { queued: 0, running: 1, succeeded: 1 } },
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);

    // 状态稳定后继续轮询：不再刷新
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await flushAsyncWork();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });
});
