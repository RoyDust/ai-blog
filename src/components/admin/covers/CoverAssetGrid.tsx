"use client";

import { motion, useReducedMotion } from "motion/react";

import { adminTextActionClassName, adminTextActionDangerClassName } from "@/components/admin/primitives/admin-classes";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { FallbackImage } from "@/components/admin/ui";
import { EmptyState, SkeletonBar, editorialEase } from "@/components/editorial";
import type { CoverAsset } from "./types";

type CoverAssetGridProps = {
  assets: CoverAsset[];
  loading?: boolean;
  onEdit: (asset: CoverAsset) => void;
  onDelete: (asset: CoverAsset) => void;
};

/**
 * 将后端保存的来源枚举转换成后台列表展示文案。
 */
function getSourceLabel(source: string) {
  if (source === "upload") return "上传";
  if (source === "manual") return "外链";
  if (source === "ai") return "AI";
  return source;
}

/**
 * 封面资产网格（方向 A）：不再是卡片，16:9 图（4px 圆角）+ 衬线标题 + 等宽 URL + 一行 meta + 文字按钮。
 *
 * 这是纯展示组件：编辑、归档和删除语义都通过回调交给 CoverGalleryManager 统一处理。
 */
export function CoverAssetGrid({ assets, loading = false, onEdit, onDelete }: CoverAssetGridProps) {
  const reduceMotion = useReducedMotion();

  if (loading) {
    return (
      <div aria-busy="true" className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
        <span className="ed-visually-hidden" role="status">
          正在加载封面图库...
        </span>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} aria-hidden="true" className="space-y-2.5">
            <SkeletonBar className="aspect-[16/9] h-auto w-full" />
            <SkeletonBar strong className="h-3.5 w-2/3" />
            <SkeletonBar className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return <EmptyState description="上传图片或添加一个现有图床链接即可开始。" role="status" title="还没有封面。" />;
  }

  return (
    <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset, index) => (
        <motion.article
          key={asset.id}
          animate={{ opacity: 1, y: 0 }}
          className="group min-w-0"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          transition={{ duration: 0.36, ease: editorialEase, delay: reduceMotion ? 0 : Math.min(index, 9) * 0.035 }}
        >
          <div className="ed-media relative aspect-[16/9] overflow-hidden rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[var(--ed-skeleton)]">
            <FallbackImage
              alt={asset.alt || asset.title || "封面图"}
              className={`object-cover ${asset.status === "active" ? "" : "opacity-55 grayscale"}`}
              fill
              sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
              src={asset.url}
              unoptimized
            />
          </div>
          <div className="mt-2.5 min-w-0">
            <h3 className="truncate font-serif text-[0.9375rem] font-bold text-[var(--foreground)]">{asset.title || asset.alt || "未命名封面"}</h3>
            <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-[var(--text-muted)]" title={asset.url}>
              {asset.url}
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1 text-xs text-[var(--text-muted)]">
              <StatusBadge tone={asset.status === "active" ? "success" : "muted"}>{asset.status === "active" ? "可用" : "归档"}</StatusBadge>
              <span className="ed-meta-sep">·</span>
              <span>{getSourceLabel(asset.source)}</span>
              <span className="ed-meta-sep">·</span>
              <span>{asset.generatedByAi ? "AI 生成" : "非 AI"}</span>
              <span className="ed-meta-sep">·</span>
              <span className="font-mono tabular-nums">使用 {asset.usageCount}</span>
            </p>
            {asset.tags.length > 0 ? (
              <p className="mt-1 truncate text-xs text-[var(--text-body)]">
                {asset.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="ed-tag mr-2">
                    #{tag}
                  </span>
                ))}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-3.5">
              <button className={adminTextActionClassName} onClick={() => void navigator.clipboard?.writeText(asset.url)} title="复制 URL" type="button">
                复制
              </button>
              <button className={adminTextActionClassName} onClick={() => onEdit(asset)} type="button">
                编辑
              </button>
              <button className={adminTextActionDangerClassName} onClick={() => onDelete(asset)} type="button">
                归档
              </button>
            </div>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
