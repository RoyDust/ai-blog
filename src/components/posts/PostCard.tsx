import Link from "next/link";
import { Card, CardContent, FallbackImage } from "@/components/ui";

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
  const formattedDate = new Date(publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card
      hover
      className={
        coverImage
          ? "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_13rem] md:items-stretch"
          : "grid grid-cols-1"
      }
      onClick={() => (window.location.href = `/posts/${slug}`)}
    >
      <CardContent className="flex min-w-0 flex-col justify-between gap-2.5 p-4 sm:p-5">
        <div>
          {category && <span className="ui-chip mb-2 rounded-md">{category}</span>}
          <Link href={`/posts/${slug}`}>
            <h2 className="text-90 hover:text-[var(--brand)] mb-1.5 text-lg font-bold leading-snug transition-colors">
              {title}
            </h2>
          </Link>
          <p className="text-75 line-clamp-2 text-sm leading-relaxed">{excerpt}</p>
        </div>
        <div className="text-50 flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-2">
            {author.avatar ? (
              <FallbackImage
                src={author.avatar}
                alt={author.name}
                className="theme-media-image h-6 w-6 rounded-lg object-cover"
                width={24}
                height={24}
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--surface-alt)]">
                <span className="text-75 text-xs font-semibold">{author.name.charAt(0)}</span>
              </div>
            )}
            <span>{author.name}</span>
          </div>
          <time className="font-mono tabular-nums" dateTime={publishedAt}>
            {formattedDate}
          </time>
        </div>
      </CardContent>
      {coverImage && (
        <div className="theme-media mx-3 mb-3 aspect-[1.55] overflow-hidden rounded-xl md:m-2.5 md:ml-0 md:aspect-auto md:min-h-[8.5rem]">
          <FallbackImage
            src={coverImage}
            alt={title}
            className="theme-media-image h-full w-full object-cover"
            width={1200}
            height={675}
          />
        </div>
      )}
    </Card>
  );
}
