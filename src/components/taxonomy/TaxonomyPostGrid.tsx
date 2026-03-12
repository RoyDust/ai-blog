import { PostCard } from '@/components/blog/PostCard'

interface TaxonomyPostGridProps {
  title: string
  description: string
  posts: Array<Parameters<typeof PostCard>[0]['post']>
}

export function TaxonomyPostGrid({ title, description, posts }: TaxonomyPostGridProps) {
  return (
    <section className="space-y-4">
      <div className="card-base p-6 md:p-8">
        <h2 className="text-90 text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  )
}
