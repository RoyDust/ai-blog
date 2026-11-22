import { PostCardSkeleton } from "@/components/blog/PostCardSkeleton";

export default function PostsLoading() {
  return (
    <div className="reader-section" aria-busy="true">
      <section className="reader-panel px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="reader-skeleton h-8 w-32 rounded-xl" />
            <div className="reader-skeleton h-4 w-64 max-w-full rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="reader-skeleton h-9 w-44 rounded-xl" />
            <div className="reader-skeleton h-9 w-36 rounded-xl" />
            <div className="reader-skeleton h-9 w-24 rounded-xl" />
          </div>
        </div>
      </section>

      <div className="grid gap-2 md:gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <PostCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
