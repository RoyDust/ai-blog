import type { ReactNode } from "react";

import { Masthead, TextLink } from "@/components/editorial";

export interface TaxonomyHeroLink {
  href: string;
  label: string;
}

interface TaxonomyHeroProps {
  /** eyebrow 小字：分类 / 标签 / 系列 / 归档 / 专题 */
  eyebrow: string;
  title: ReactNode;
  /** 描述，最多 2 行 */
  description?: ReactNode;
  /** 等宽 meta，如「24 篇文章 · 最近更新 2026-03-06」 */
  meta?: ReactNode;
  /** 右侧只放文字链接（简报 16.5） */
  links?: TaxonomyHeroLink[];
  titleId?: string;
}

/**
 * 报头式专题头（简报 16.5）：eyebrow + 衬线 h1 + 2 行内描述 + 等宽 meta，
 * 右侧只放「… →」文字链接，下方 2px 粗线。没有渐变、光斑、背景块和主按钮。
 *
 * 专题头在首屏，刻意不加入场动画：用 opacity 隐藏首屏内容会在缓存切换时闪烁。
 */
export function TaxonomyHero({ eyebrow, title, description, meta, links = [], titleId }: TaxonomyHeroProps) {
  return (
    <Masthead
      aside={
        links.length > 0 ? (
          <>
            {links.map((link) => (
              <TextLink key={link.href} href={link.href}>
                {link.label}
              </TextLink>
            ))}
          </>
        ) : undefined
      }
      description={description}
      eyebrow={eyebrow}
      meta={meta}
      title={title}
      titleId={titleId}
    />
  );
}
