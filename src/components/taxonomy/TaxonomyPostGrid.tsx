import type { ReactNode } from "react";

import { PostCard, type PostCardPost } from "@/components/blog/PostCard";
import { EditorialPagination, SectionHeading, StaggerItem, StaggerList } from "@/components/editorial";

interface TaxonomyPostGridProps {
  /** 区块标题，默认「文章」 */
  title?: string;
  /** 标题后的等宽计数 */
  count?: ReactNode;
  /** 区块标题右侧小字，默认「按发布时间」 */
  aside?: ReactNode;
  posts: PostCardPost[];
  /** stacked：两行日期；index：两位序号（系列详情） */
  dateStyle?: "stacked" | "index";
  hideCategory?: boolean;
  hideTag?: boolean;
  /** 底部页码；只有一页时不渲染 */
  pagination?: {
    page: number;
    totalPages: number;
    basePath: string;
  };
  /** 没有文章时显示在区块标题下方的空态 */
  empty?: ReactNode;
  headingId?: string;
}

function buildPageHref(basePath: string, page: number) {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

/**
 * 专题页的文章区块：区块标题「文章 N」+ 右侧排序说明，下方是全站列表行（简报 16.1 / 16.5），
 * 底部居中页码。分类详情、标签详情、系列详情共用。
 */
export function TaxonomyPostGrid({
  title = "文章",
  count,
  aside = "按发布时间",
  posts,
  dateStyle = "stacked",
  hideCategory = false,
  hideTag = false,
  pagination,
  empty,
  headingId = "taxonomy-posts-title",
}: TaxonomyPostGridProps) {
  return (
    <section aria-labelledby={headingId} className="space-y-1">
      <SectionHeading aside={aside ? <span>{aside}</span> : undefined} count={count} id={headingId} title={title} />

      {posts.length > 0 ? (
        <>
          <StaggerList>
            {posts.map((post, index) => (
              <StaggerItem key={post.id}>
                <PostCard
                  dateStyle={dateStyle}
                  hideCategory={hideCategory}
                  hideTag={hideTag}
                  index={index + 1}
                  post={post}
                />
              </StaggerItem>
            ))}
          </StaggerList>
          {pagination ? (
            <EditorialPagination
              className="border-t-0 pt-6"
              hrefForPage={(page) => buildPageHref(pagination.basePath, page)}
              page={pagination.page}
              totalPages={pagination.totalPages}
            />
          ) : null}
        </>
      ) : (
        empty
      )}
    </section>
  );
}
