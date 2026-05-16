import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CopyCodeButton } from "../CopyCodeButton";

describe("CopyCodeButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  test("copies code to the clipboard and shows a success state", async () => {
    render(<CopyCodeButton code={"const x = 1"} />);

    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("const x = 1");
    });
    expect(screen.getByRole("button", { name: "代码已复制" })).toHaveTextContent("已复制");
  });

  test("handles missing clipboard support without throwing", () => {
    Object.assign(navigator, { clipboard: undefined });

    render(<CopyCodeButton code={"const x = 1"} />);

    fireEvent.click(screen.getByRole("button", { name: "复制代码" }));

    expect(screen.getByRole("button", { name: "复制代码" })).toHaveTextContent("失败");
  });
});
