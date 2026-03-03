import Link from "next/link";

interface PostMetaProps {
  publishedAt: string | Date;
  updatedAt?: string | Date;
  category?: { name: string; slug: string } | null;
  tags?: Array<{ name: string; slug: string }>;
  hideTagsForMobile?: boolean;
  hideUpdateDate?: boolean;
  className?: string;
}

export function PostMeta({
  publishedAt,
  updatedAt,
  category,
  tags = [],
  hideTagsForMobile = false,
  hideUpdateDate = true,
  className = "",
}: PostMetaProps) {
  return (
    <div className={`text-50 flex flex-wrap items-center gap-2 text-xs ${className}`}>
      {category ? (
        <Link className="rounded-full bg-[var(--btn-regular-bg)] px-2 py-1 text-[var(--btn-content)]" href={`/categories/${category.slug}`}>
          {category.name}
        </Link>
      ) : null}
      <span>{new Date(publishedAt).toLocaleDateString("zh-CN")}</span>
      {!hideUpdateDate && updatedAt ? <span>更新于 {new Date(updatedAt).toLocaleDateString("zh-CN")}</span> : null}
      {tags.map((tag) => (
        <Link
          key={tag.slug}
          className={`rounded-full px-2 py-1 ${hideTagsForMobile ? "hidden md:inline-flex" : "inline-flex"} bg-[var(--btn-regular-bg)] text-[var(--btn-content)]`}
          href={`/tags/${tag.slug}`}
        >
          #{tag.name}
        </Link>
      ))}
    </div>
  );
}
