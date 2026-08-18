"use client";

import { useCallback, useState } from "react";

/**
 * 列表筛选记忆（localStorage）的共享实现。
 *
 * 后台文章列表（usePostsList）与评论列表（app/admin/comments）各自维护一套
 * "查询词 + 状态过滤 + 分页"筛选条件并持久化到 localStorage，刷新后恢复。
 * 读写的脚手架（window 守卫、JSON 解析、try/catch、正整数回退）在此统一，
 * 字段级校验由调用方注入 validate，保持各列表自己的合法值集合。
 */

export function readPositiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function readFilterMemory<T extends object>(
  key: string,
  fallback: T,
  validate: (parsed: Partial<T>, fallback: T) => T,
): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Partial<T>;
    return validate(parsed, fallback);
  } catch {
    return fallback;
  }
}

export function writeFilterMemory(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in private or constrained browser contexts.
  }
}

/**
 * 惰性读取一次筛选记忆，并返回稳定的写回函数。
 *
 * 用法：
 *   const { initialMemory, persist } = useFilterMemory(key, fallback, validate);
 *   const [query, setQuery] = useState(initialMemory.query);
 *   useEffect(() => persist({ query, statusFilter, page, pageSize }), [...]);
 */
export function useFilterMemory<T extends object>(
  key: string,
  fallback: T,
  validate: (parsed: Partial<T>, fallback: T) => T,
) {
  const [initialMemory] = useState(() => readFilterMemory(key, fallback, validate));
  const persist = useCallback((value: T) => writeFilterMemory(key, value), [key]);
  return { initialMemory, persist };
}
