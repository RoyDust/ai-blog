import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

import { FallbackImage } from "../FallbackImage";

vi.mock("next/image", () => ({
  default: ({ fill, ...props }: React.ComponentProps<"img"> & { fill?: boolean }) => {
    void fill;
    return React.createElement("img", { ...props, alt: props.alt ?? "" });
  },
}));

describe("FallbackImage", () => {
  test("falls back to the shared error image when the original source fails", () => {
    render(<FallbackImage alt="broken cover" height={400} src="https://example.com/broken.png" width={800} />);

    const image = screen.getByRole("img", { name: "broken cover" });

    expect(image).toHaveAttribute("src", "https://example.com/broken.png");

    fireEvent.error(image);

    expect(image).toHaveAttribute("src", "/imgs/Error.png");
  });
});
