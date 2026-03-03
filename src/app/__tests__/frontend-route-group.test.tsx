import { expect, test } from "vitest";
import PublicLayout from "@/app/(public)/layout";

test("public layout exists and is composable", () => {
  expect(PublicLayout).toBeDefined();
});
