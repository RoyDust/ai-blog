import { PostCard, PostCardProps } from './PostCard';
import { Pagination, PaginationProps } from './Pagination';

export interface PostListProps {
  posts: PostCardProps[];
  pagination?: PaginationProps;
}

export function PostList({ posts, pagination }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No posts found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.slug} {...post} />
        ))}
      </div>

      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
