import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Card } from "@/components/ui/Card";

test("card is a flat editorial paper without shadow or hover lift", () => {
  const { container } = render(<Card>Body</Card>);
  const card = container.firstElementChild;

  expect(card).toHaveClass("rounded-[var(--radius-paper)]", "border-[var(--reader-border)]", "bg-[var(--card-bg)]");
  expect(card?.className).not.toMatch(/shadow|card-base/);
});
