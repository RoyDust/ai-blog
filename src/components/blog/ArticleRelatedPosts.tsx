import Link from "next/link";
import { MetaLine, SectionHeading } from "@/components/editorial";
import { FallbackImage } from "@/components/ui";
import { formatIsoDate } from "@/lib/editorial-format";

type RelatedPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  createdAt: string | Date;
  publishedAt?: string | Date | null;
  category?: {
    name: string;
    slug: string;
  } | null;
};

interface ArticleRelatedPostsProps {
  posts: RelatedPost[];
}

/**
 * 相关文章（简报 16.4）：区块标题 + 三列，每列 16:9 封面（4px）、衬线标题最多 2 行、meta「分类 · 日期」。
 * 无封面的一篇用 surface-alt 的 16:9 块，左下角衬线写分类名。手机上单列，封面在左侧 6.5rem。
 */
export function ArticleRelatedPosts({ posts }: ArticleRelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="related-posts-heading" className="space-y-4">
      <SectionHeading id="related-posts-heading" title="相关文章" />
      <ul className="article-related__list">
        {posts.map((post) => (
          <li key={post.id}>
            <Link className="article-related__item group" href={`/posts/${post.slug}`}>
              <span className="article-related__cover block">
                {post.coverImage ? (
                  <FallbackImage
                    alt=""
                    className="object-cover"
                    fill
                    sizes="(min-width: 640px) 220px, 104px"
                    src={post.coverImage}
                  />
                ) : (
                  <span aria-hidden="true" className="article-related__placeholder">
                    {post.category?.name ?? ""}
                  </span>
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="article-related__title">{post.title}</span>
                <MetaLine
                  items={[
                    post.category?.name,
                    <time className="ed-mono" dateTime={new Date(post.publishedAt ?? post.createdAt).toISOString()} key="date">
                      {formatIsoDate(post.publishedAt ?? post.createdAt)}
                    </time>,
                  ]}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
