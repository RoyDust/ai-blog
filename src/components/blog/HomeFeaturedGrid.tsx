import { PostCardFeatured } from "./PostCardFeatured";
import { PostCardSecondary } from "./PostCardSecondary";
import { SectionHeader } from "./SectionHeader";
import { getListRevealAnimationProps } from "./listAnimation";

interface HomeFeaturedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage?: string | null;
  createdAt: Date | string;
  author: { id: string; name: string | null; image: string | null };
  category: { id?: string; name: string; slug: string } | null;
  tags: Array<{ id?: string; name: string; slug: string }>;
  _count: { comments: number; likes: number };
}

interface HomeFeaturedGridProps {
  leadPost: HomeFeaturedPost | null;
  secondaryPosts: HomeFeaturedPost[];
}

export function HomeFeaturedGrid({ leadPost, secondaryPosts }: HomeFeaturedGridProps) {
  if (!leadPost) {
    return (
      <section className="reader-section">
        <SectionHeader
          eyebrow="精选"
          title="本期主推"
          description="精选位正在整理中，先从最新文章继续阅读。"
          variant="reader"
        />

        <div className="reader-feature-card p-6 md:p-8">
          <div className="max-w-2xl space-y-3">
            <p className="ui-kicker text-[var(--accent-warm)]">Coming Soon</p>
            <h3 id="home-featured-title" className="font-display text-2xl font-bold text-[var(--foreground)]">
              夜读书架还在编选
            </h3>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              当前没有置顶精选，页面会继续展示最新发布与主题索引，保持阅读入口完整。
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="reader-section">
      <SectionHeader
        eyebrow="精选"
        title="本期主推"
        description="像夜间书桌上的第一本打开笔记，先读一篇重点，再顺手延伸到相邻主题。"
        variant="reader"
      />

      <div className="space-y-4">
        <div {...getListRevealAnimationProps(0)}>
          <PostCardFeatured post={leadPost} />
        </div>

        {secondaryPosts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2" data-testid="home-featured-secondary-grid">
            {secondaryPosts.map((post, index) => (
              <div key={post.id} data-testid="home-featured-secondary-item" {...getListRevealAnimationProps(index + 1)}>
                <PostCardSecondary post={post} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
