import { PostCard } from "@/components/blog/PostCard";

interface TaxonomyPostGridProps {
  title: string;
  description: string;
  posts: Array<Parameters<typeof PostCard>[0]["post"]>;
}

export function TaxonomyPostGrid({ title, description, posts }: TaxonomyPostGridProps) {
  return (
    <section className="reader-section">
      <div className="reader-panel px-5 py-4 md:px-6">
        <h2 className="reader-section-heading text-base">{title}</h2>
        <p className="text-75 mt-1.5 text-sm leading-6">{description}</p>
      </div>

      {posts.length > 0 ? (
        <div className="grid gap-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="reader-panel p-7 text-sm text-[var(--text-muted)]">当前主题下还没有可阅读的文章。</div>
      )}
    </section>
  );
}
