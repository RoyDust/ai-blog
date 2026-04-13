import { PostCard } from "./PostCard";
import { PostCardFeatured } from "./PostCardFeatured";
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
    return null;
  }

  return (
    <section className="ui-section">
      <SectionHeader
        eyebrow="精选"
        title="精选文章"
        description="先读一篇主推，再延伸到两篇相关内容，保持首页阅读节奏。"
      />

      <div className="space-y-4">
        <div {...getListRevealAnimationProps(0)}>
          <PostCardFeatured post={leadPost} />
        </div>

        {secondaryPosts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2" data-testid="home-featured-secondary-grid">
            {secondaryPosts.map((post, index) => (
              <div key={post.id} data-testid="home-featured-secondary-item" {...getListRevealAnimationProps(index + 1)}>
                <PostCard post={post} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
