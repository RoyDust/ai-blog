import { BookOpenText } from "lucide-react";
import { PostCard } from "@/components/blog/PostCard";

interface TaxonomyPostGridProps {
  title: string;
  description: string;
  posts: Array<Parameters<typeof PostCard>[0]["post"]>;
}

export function TaxonomyPostGrid({ title, description, posts }: TaxonomyPostGridProps) {
  return (
    <section className="reader-section">
      <div className="reader-panel p-6 md:p-8">
        <div className="flex items-start gap-3">
          <span className="reader-icon-btn h-11 w-11 shrink-0 text-[var(--accent-warm)]">
            <BookOpenText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-90 text-2xl font-bold">{title}</h2>
            <p className="text-75 mt-2 text-sm leading-6">{description}</p>
          </div>
        </div>
      </div>

      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="reader-panel p-8 text-sm text-[var(--text-muted)]">当前主题下还没有可阅读的文章。</div>
      )}
    </section>
  );
}
