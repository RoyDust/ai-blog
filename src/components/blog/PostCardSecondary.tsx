import Link from "next/link";
import { BookOpen } from "lucide-react";
import { FallbackImage } from "@/components/ui";

interface PostCardSecondaryProps {
  post: {
    id: string;
    title: string;
    slug: string;
    coverImage?: string | null;
    createdAt: string | Date;
    category?: { name: string; slug: string } | null;
  };
}

export function PostCardSecondary({ post }: PostCardSecondaryProps) {
  const hasCover = Boolean(post.coverImage);

  return (
    <article className="card-base relative h-52 overflow-hidden">
      {hasCover ? (
        <>
          <FallbackImage
            alt={post.title}
            className="object-cover"
            fill
            loading="lazy"
            quality={75}
            sizes="(max-width: 768px) 100vw, 50vw"
            src={post.coverImage!}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--surface-alt) 80%, var(--border)) 0%, color-mix(in srgb, var(--surface-alt) 40%, var(--border)) 100%)" }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <filter id="pcs-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#pcs-noise)" />
          </svg>
          <BookOpen
            aria-hidden="true"
            className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-(--text-base) opacity-[0.07]"
            size={72}
            strokeWidth={1}
          />
        </div>
      )}

      <div className="absolute inset-0 flex flex-col justify-end p-5">
        {post.category && (
          <span
            className={`mb-2 w-fit rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
              hasCover
                ? "bg-white/20 text-white backdrop-blur-sm"
                : "bg-(--surface) text-50"
            }`}
          >
            {post.category.name}
          </span>
        )}
        <Link href={`/posts/${post.slug}`}>
          <h3
            className={`line-clamp-2 text-base font-bold leading-snug transition ${
              hasCover
                ? "text-white hover:text-white/80"
                : "text-90 hover:text-(--primary)"
            }`}
          >
            {post.title}
          </h3>
        </Link>
        <span
          className={`mt-2 text-xs ${hasCover ? "text-white/60" : "text-50"}`}
        >
          {new Date(post.createdAt).toLocaleDateString("zh-CN")}
        </span>
      </div>
    </article>
  );
}
