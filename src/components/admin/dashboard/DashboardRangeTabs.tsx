"use client";

import Link from "next/link";

import { ActiveUnderline } from "@/components/editorial";
import { adminTabClassName } from "@/components/admin/primitives/admin-classes";
import type { VisitTrendRange } from "@/lib/analytics";

const RANGES: VisitTrendRange[] = [7, 30, 90];

/**
 * 访问趋势区间：7 / 30 / 90 天文字 tab，当前项 foreground + 2px sky 下划线（切换时平移）。
 */
export function DashboardRangeTabs({ range }: { range: VisitTrendRange }) {
  return (
    <nav aria-label="统计区间" className="flex gap-0.5">
      {RANGES.map((item) => {
        const isActive = range === item;
        return (
          <Link
            key={item}
            aria-current={isActive ? "page" : undefined}
            className={adminTabClassName}
            href={`/admin?range=${item}`}
            scroll={false}
          >
            {item} 天
            {isActive ? <ActiveUnderline layoutId="admin-dashboard-range" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
