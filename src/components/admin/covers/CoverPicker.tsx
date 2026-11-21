"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Images, Search } from "lucide-react";
import useSWR from "swr";

import { Button, FallbackImage, Modal } from "@/components/admin/ui";
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
        <Images className="mr-1 h-4 w-4" aria-hidden="true" />
        {buttonLabel}
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="选择封面" size="4xl" contentClassName="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
            <input
              aria-label="搜索封面"
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              placeholder="搜索标题、URL、标签"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
            />
          </label>
          {selected ? <span className="text-sm text-[var(--muted)]">当前：{selected.title || selected.url}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "全部图片" },
            { key: "uploaded", label: "上传图片" },
            { key: "ai-generated", label: "AI 生成" },
          ].map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={imageKindFilter === item.key ? "default" : "outline"}
              onClick={() => setImageKindFilter(item.key as typeof imageKindFilter)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {errorMessage ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p> : null}
        {isLoading ? <p className="py-10 text-center text-sm text-[var(--muted)]">正在加载封面...</p> : null}
        {!isLoading && assets.length === 0 ? <p className="py-10 text-center text-sm text-[var(--muted)]">图库暂无可用封面。</p> : null}

        {!isLoading && assets.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left transition-colors hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                onClick={() => {
                  onSelect(asset);
                  setOpen(false);
                }}
              >
                <span className="relative block aspect-[16/9] bg-[var(--surface-alt)]">
                  <FallbackImage
                    alt={asset.alt || asset.title || "封面图"}
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 28vw, (min-width: 640px) 42vw, 100vw"
                    src={asset.url}
                    unoptimized
                  />
                </span>
                <span className="block space-y-1 p-3">
                  <span className="block truncate text-sm font-medium text-[var(--foreground)]">{asset.title || asset.alt || "未命名封面"}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{asset.url}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
