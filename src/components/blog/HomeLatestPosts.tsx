import { EmptyState, Reveal, SectionHeading, StaggerItem, StaggerList, TextLink } from "@/components/editorial";
import { PostCard, type PostCardPost } from "./PostCard";

interface HomeLatestPostsProps {
  posts: PostCardPost[];
}

/**
 * 首页最新文章（简报 15.9 第 4 条）：区块标题 +「全部文章 →」，5 行列表行，日期写单行「10-18」。
 */
export function HomeLatestPosts({ posts }: HomeLatestPostsProps) {
  return (
    <Reveal as="section" aria-labelledby="home-latest-title" className="space-y-1">
      <SectionHeading id="home-latest-title" title="最新文章" aside={<TextLink href="/posts">全部文章</TextLink>} />

      {posts.length === 0 ? (
        <EmptyState
          title="还没有发布文章，第一篇正在路上。"
          actions={
            <>
              <TextLink href="/series">浏览系列</TextLink>
              <TextLink href="/about">关于作者</TextLink>
            </>
          }
        />
      ) : (
        <StaggerList inView className="home-latest-posts-stage">
          {posts.map((post) => (
            <StaggerItem key={post.id}>
              <PostCard dateStyle="short" post={post} showFeaturedLabel={false} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </Reveal>
  );
}
