import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Navbar } from "@/components/layout/Navbar";

test("navbar renders search and hue actions", () => {
  const { getAllByRole, getByLabelText, queryByRole } = render(<Navbar />);
  expect(getByLabelText("搜索")).toBeInTheDocument();
  expect(getByLabelText("主题色设置")).toBeInTheDocument();
  expect(getByLabelText("搜索文章")).toBeInTheDocument();
  expect(getAllByRole("link", { name: "归档" }).every((link) => link.getAttribute("href") === "/archives")).toBe(true);
  expect(queryByRole("link", { name: "分类" })).not.toBeInTheDocument();
  expect(queryByRole("link", { name: "标签" })).not.toBeInTheDocument();
});
