import { render, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, test, vi } from "vitest";

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

describe("AiTaskActivitySync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiMutate.mockResolvedValue({ success: true });
  });

  test("uses the shared API client for both resume endpoints and refreshes after settling", async () => {
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
});
