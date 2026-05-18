import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MotionIconButton } from "../MotionIconButton";
import { MotionList } from "../MotionList";
import { MotionPanel } from "../MotionPanel";
import { MotionReveal } from "../MotionReveal";

afterEach(() => {
  cleanup();
});

describe("MotionReveal", () => {
  test("renders children", () => {
    render(<MotionReveal><span>hello</span></MotionReveal>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  test("passes className to wrapper", () => {
    const { container } = render(
      <MotionReveal className="my-class"><span>x</span></MotionReveal>,
    );
    expect(container.firstChild).toHaveClass("my-class");
  });

  test("delayIndex does not crash with large values", () => {
    expect(() =>
      render(<MotionReveal delayIndex={99}><span>y</span></MotionReveal>)
    ).not.toThrow();
  });
});

describe("MotionList", () => {
  const items = [
    { id: "a", label: "Item A" },
    { id: "b", label: "Item B" },
  ];

  test("renders all items", () => {
    render(
      <MotionList
        items={items}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
  });

  test("renders as ul", () => {
    render(
      <MotionList
        items={items}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  test("passes className", () => {
    const { container } = render(
      <MotionList
        items={items}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
        className="list-class"
      />,
    );
    expect(container.firstChild).toHaveClass("list-class");
  });
});

describe("MotionIconButton", () => {
  test("renders children", () => {
    render(<MotionIconButton>click me</MotionIconButton>);
    expect(screen.getByRole("button", { name: "click me" })).toBeInTheDocument();
  });

  test("passes aria-label", () => {
    render(<MotionIconButton aria-label="返回顶部">↑</MotionIconButton>);
    expect(screen.getByRole("button", { name: "返回顶部" })).toBeInTheDocument();
  });

  test("passes className", () => {
    render(<MotionIconButton className="btn-class">x</MotionIconButton>);
    expect(screen.getByRole("button")).toHaveClass("btn-class");
  });

  test("passes disabled", () => {
    render(<MotionIconButton disabled>x</MotionIconButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("MotionPanel", () => {
  test("renders children when open=true", () => {
    render(<MotionPanel open><span>panel content</span></MotionPanel>);
    expect(screen.getByText("panel content")).toBeInTheDocument();
  });

  test("does not render children when open=false", () => {
    render(<MotionPanel open={false}><span>panel content</span></MotionPanel>);
    expect(screen.queryByText("panel content")).not.toBeInTheDocument();
  });

  test("passes className when open", () => {
    const { container } = render(
      <MotionPanel open className="panel-class"><span>x</span></MotionPanel>,
    );
    expect(container.firstChild).toHaveClass("panel-class");
  });
});
