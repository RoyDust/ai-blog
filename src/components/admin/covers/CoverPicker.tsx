"use client";

import { useEffect, useMemo, useState } from "react";
import { Images, Search } from "lucide-react";

import { Button, FallbackImage, Modal } from "@/components/ui";
import type { CoverAsset, CoverAssetListResponse } from "./types";

type CoverPickerProps = {
  selectedAssetId?: string | null;
  onSelect: (asset: CoverAsset) => void;
  buttonLabel?: string;
};

export function CoverPicker({ selectedAssetId, onSelect, buttonLabel = "从图库选择" }: CoverPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<CoverAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ status: "active", limit: "50" });
        if (query.trim()) {
          params.set("q", query.trim());
        }
        const response = await fetch(`/api/admin/covers?${params.toString()}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "封面图库加载失败");
        }

        if (!active) return;
        const payload = data.data as CoverAssetListResponse;
        setAssets(Array.isArray(payload.items) ? payload.items : []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "封面图库加载失败");
        setAssets([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void load();
    }, query ? 250 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

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
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {selected ? <span className="text-sm text-[var(--muted)]">当前：{selected.title || selected.url}</span> : null}
        </div>

        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {loading ? <p className="py-10 text-center text-sm text-[var(--muted)]">正在加载封面...</p> : null}
        {!loading && assets.length === 0 ? <p className="py-10 text-center text-sm text-[var(--muted)]">图库暂无可用封面。</p> : null}

        {!loading && assets.length > 0 ? (
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
