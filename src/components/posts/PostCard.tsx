import Link from 'next/link';
import { Card, CardContent, FallbackImage } from '@/components/ui';

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
        <div className="theme-media aspect-video w-full rounded-t-lg">
          <FallbackImage
            src={coverImage}
            alt={title}
            className="theme-media-image h-full w-full object-cover"
            width={1200}
            height={675}
          />
        </div>
      )}
      <CardContent>
        {category && (
          <span className="ui-chip mb-2">
            {category}
          </span>
        )}
        <Link href={`/posts/${slug}`}>
          <h2 className="text-90 hover:text-[var(--brand-strong)] mb-2 text-xl font-semibold transition-colors">
            {title}
          </h2>
        </Link>
        <p className="text-75 mb-4 text-sm line-clamp-2">
          {excerpt}
        </p>
        <div className="text-50 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {author.avatar ? (
              <FallbackImage
                src={author.avatar}
                alt={author.name}
                className="theme-media-image h-6 w-6 rounded-full object-cover"
                width={24}
                height={24}
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-alt)]">
                <span className="text-75 text-xs">
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
