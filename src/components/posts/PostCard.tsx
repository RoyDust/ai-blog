import Link from 'next/link';
import { Card, CardContent } from '@/components/ui';

export interface PostCardProps {
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  author: {
    name: string;
    avatar?: string;
  };
  publishedAt: string;
  category?: string;
}

export function PostCard({
  slug,
  title,
  excerpt,
  coverImage,
  author,
  publishedAt,
  category,
}: PostCardProps) {
  const formattedDate = new Date(publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card hover onClick={() => (window.location.href = `/posts/${slug}`)}>
      {coverImage && (
        <div className="aspect-video w-full overflow-hidden rounded-t-lg">
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent>
        {category && (
          <span className="inline-block px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded mb-2">
            {category}
          </span>
        )}
        <Link href={`/posts/${slug}`}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2">
            {title}
          </h2>
        </Link>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
          {excerpt}
        </p>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
          <div className="flex items-center gap-2">
            {author.avatar ? (
              <img
                src={author.avatar}
                alt={author.name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {author.name.charAt(0)}
                </span>
              </div>
            )}
            <span>{author.name}</span>
          </div>
          <time dateTime={publishedAt}>{formattedDate}</time>
        </div>
      </CardContent>
    </Card>
  );
}
