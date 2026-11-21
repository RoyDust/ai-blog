import { fireEvent, render } from "@testing-library/react";
import { expect, test } from "vitest";
import { HuePicker } from "@/components/ui/HuePicker";

test("hue picker writes --hue to root and localStorage", () => {
  const { getByRole } = render(<HuePicker isOpen={true} />);
  fireEvent.change(getByRole("slider"), { target: { value: "210" } });

  expect(document.documentElement.style.getPropertyValue("--hue")).toBe("210");
  expect(localStorage.getItem("theme-hue")).toBe("210");
});
