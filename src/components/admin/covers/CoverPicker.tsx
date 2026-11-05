"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import useSWR from "swr";

import { adminTabClassName } from "@/components/admin/primitives/admin-classes";
import { Button, FallbackImage, Modal } from "@/components/admin/ui";
import { FadeBanner } from "@/components/admin/workspace/WorkspaceKit";
import { ActiveUnderline, SkeletonBar } from "@/components/editorial";
import { apiFetcher, toErrorMessage } from "@/lib/client-api";
import type { CoverAsset, CoverAssetListResponse } from "./types";

type CoverPickerProps = {
  selectedAssetId?: string | null;
  onSelect: (asset: CoverAsset) => void;
  buttonLabel?: string;
};

/**
 * 可复用的封面图库选择器。
 *
 * 父组件只关心选中的 CoverAsset；弹窗内部负责按关键词加载可用封面、
 * 展示当前选择，并在确认后关闭弹窗。
 */
export function CoverPicker({ selectedAssetId, onSelect, buttonLabel = "从图库选择" }: CoverPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [imageKindFilter, setImageKindFilter] = useState<"all" | "uploaded" | "ai-generated">("all");

  // 搜索词 250ms 防抖（setState 只发生在事件回调与定时器回调中）
  const debounceTimerRef = useRef<number | null>(null);
  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedQuery(value);
    }, value ? 250 : 0);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const coverParams = useMemo(() => {
    const params = new URLSearchParams({ status: "active", limit: "50" });
    const keyword = debouncedQuery.trim();
    if (keyword) {
      params.set("q", keyword);
    }
    if (imageKindFilter === "uploaded") {
      params.set("source", "upload");
      params.set("generatedByAi", "false");
    } else if (imageKindFilter === "ai-generated") {
      params.set("generatedByAi", "true");
    }
    return params.toString();
  }, [debouncedQuery, imageKindFilter]);

  // 弹窗打开时按当前筛选加载图库；过期结果由 SWR 的 key 机制自动隔离
  const { data, error: loadError, isLoading } = useSWR<{ success?: boolean; data?: CoverAssetListResponse }>(
    open ? `/api/admin/covers?${coverParams}` : null,
    apiFetcher,
    { keepPreviousData: true },
  );

  const assets = useMemo(() => data?.data?.items ?? [], [data?.data?.items]);
  const errorMessage = loadError ? toErrorMessage(loadError, "封面图库加载失败") : "";

  const selected = useMemo(() => assets.find((asset) => asset.id === selectedAssetId), [assets, selectedAssetId]);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="选择封面" size="4xl" contentClassName="flex flex-col gap-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <input
              aria-label="搜索封面"
              className="h-9 w-full rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent pr-3 pl-8 text-base text-[var(--foreground)] transition-[border-color] duration-150 placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)] md:text-sm"
              placeholder="搜索标题、URL、标签"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
            />
          </label>
          {selected ? <span className="min-w-0 truncate text-[0.8125rem] text-[var(--text-muted)]">当前：{selected.title || selected.url}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)]" role="group" aria-label="图片来源">
          {[
            { key: "all", label: "全部图片" },
            { key: "uploaded", label: "上传图片" },
            { key: "ai-generated", label: "AI 生成" },
          ].map((item) => {
            const active = imageKindFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                className={adminTabClassName}
                onClick={() => setImageKindFilter(item.key as typeof imageKindFilter)}
              >
                {item.label}
                {active ? <ActiveUnderline layoutId="cover-picker-kind" /> : null}
              </button>
            );
          })}
        </div>

        <FadeBanner message={errorMessage} tone="danger" />
        {isLoading ? (
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="正在加载封面">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2">
                <SkeletonBar className="aspect-[16/9] h-auto w-full" />
                <SkeletonBar className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : null}
        {!isLoading && !errorMessage && assets.length === 0 ? (
          <p className="ed-empty__title py-6">图库暂无可用封面。</p>
        ) : null}

        {!isLoading && assets.length > 0 ? (
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => {
              const isSelected = asset.id === selectedAssetId;
              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-current={isSelected ? "true" : undefined}
                  className="group min-w-0 cursor-pointer text-left"
                  onClick={() => {
                    onSelect(asset);
                    setOpen(false);
                  }}
                >
                  <span
                    className={`relative block aspect-[16/9] overflow-hidden rounded-[var(--radius-ctl)] border bg-[var(--ed-skeleton)] transition-[border-color] duration-150 ${isSelected ? "border-[var(--foreground)]" : "border-[var(--border)] group-hover:border-[var(--text-muted)]"}`}
                  >
                    <FallbackImage
                      alt={asset.alt || asset.title || "封面图"}
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      fill
                      sizes="(min-width: 1024px) 28vw, (min-width: 640px) 42vw, 100vw"
                      src={asset.url}
                      unoptimized
                    />
                  </span>
                  <span className="mt-2 block truncate text-[0.8125rem] font-bold text-[var(--foreground)]">{asset.title || asset.alt || "未命名封面"}</span>
                  <span className="block truncate font-mono text-xs text-[var(--text-muted)]">{asset.url}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
