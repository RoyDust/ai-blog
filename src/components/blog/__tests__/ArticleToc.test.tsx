import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

const capturedLayoutGroupIds: Array<string | undefined> = [];

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    LayoutGroup: ({ id, children }: { id?: string; children: ReactNode }) => {
      capturedLayoutGroupIds.push(id);
      return <actual.LayoutGroup id={id}>{children}</actual.LayoutGroup>;
    },
  };
});

import { ArticleToc } from "../ArticleToc";

describe("ArticleToc LayoutGroup isolation", () => {
  test("assigns distinct LayoutGroup ids across rail and drawer instances", () => {
    capturedLayoutGroupIds.length = 0;

    const headings = [
      { id: "intro", text: "引言", level: 2 as const },
      { id: "summary", text: "总结", level: 2 as const },
    ];

    render(
      <>
        <ArticleToc headings={headings} variant="rail" />
        <ArticleToc headings={headings} variant="drawer" />
      </>,
    );

    expect(capturedLayoutGroupIds).toHaveLength(2);
    expect(capturedLayoutGroupIds[0]).toBeTruthy();
    expect(capturedLayoutGroupIds[1]).toBeTruthy();
    expect(capturedLayoutGroupIds[0]).not.toBe(capturedLayoutGroupIds[1]);
  });
});
