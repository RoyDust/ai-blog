import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Card } from "@/components/ui/Card";

test("card adopts blogt3 foundation class contract", () => {
  const { container } = render(<Card>Body</Card>);
  expect(container.firstElementChild?.className).toContain("card-base");
});
