import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Navbar } from "@/components/layout/Navbar";

test("navbar renders search and hue actions", () => {
  const { getByLabelText } = render(<Navbar />);
  expect(getByLabelText("搜索")).toBeInTheDocument();
  expect(getByLabelText("主题色设置")).toBeInTheDocument();
});
