interface PostMetaProps {
  publishedAt: string | Date;
  category?: { name: string; slug: string } | null;
  tags?: Array<{ name: string; slug: string }>;
}

export function PostMeta({ publishedAt, category, tags = [] }: PostMetaProps) {
  return (
    <div className="text-50 flex flex-wrap items-center gap-2 text-xs">
      {category ? <span>{category.name}</span> : null}
      <span>{new Date(publishedAt).toLocaleDateString("zh-CN")}</span>
      {tags.slice(0, 2).map((tag) => (
        <span key={tag.slug}>#{tag.name}</span>
      ))}
    </div>
  );
}
