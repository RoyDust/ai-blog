import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PageTransition } from "@/components/layout/PageTransition";

/**
 * 契约：路由内容必须原样透传。
 *
 * - 不允许 motion/AnimatePresence 包装层：presence 的 initial={false} 会
 *   禁用子树全部入场动画；带 opacity 初始态的包装层会把缓存返回的可见
 *   内容重新隐藏（43df139 修过的闪烁）。路由过渡由 View Transitions 承担。
 */
describe("PageTransition", () => {
  test("renders children as-is without any wrapper that could hide cached content", () => {
    const { container } = render(
      <PageTransition>
        <span>Series</span>
      </PageTransition>,
    );

    expect(screen.getByText("Series")).toBeInTheDocument();

    const span = screen.getByText("Series");
    expect(span.parentElement).toBe(container);
    expect(container.querySelector("[style*='opacity']")).toBeNull();
  });
});
