import { getPublishedPostsPage } from "@/lib/posts";
import { getCategoryDirectory, getTagDirectory } from "@/lib/taxonomy";
import { getBlogSettings } from "@/lib/blog-settings";
import FuwariClientPage from "@/components/blog/FuwariClientPage";

export const revalidate = 0; // Disable server-side routing cache to ensure fresh preview on every load

export default async function FuwariBlogServerPage() {
  const [
    postsData,
    categoriesData,
    tagsData,
    blogSettings
  ] = await Promise.all([
    getPublishedPostsPage({ page: 1, limit: 100 }),
    getCategoryDirectory(),
    getTagDirectory(),
    getBlogSettings()
  ]);

  // Convert Date objects to strings for clean prop serialization in Next.js Server-to-Client boundary
  const serializedPosts = postsData.posts.map(post => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    createdAt: post.createdAt.toISOString(),
    readingTimeMinutes: post.readingTimeMinutes,
    viewCount: post.viewCount,
    category: post.category ? {
      name: post.category.name,
      slug: post.category.slug
    } : null,
    tags: post.tags.map(t => ({
      name: t.name,
      slug: t.slug
    }))
  }));

  // Map to clean formats for categories and tags
  const serializedCategories = categoriesData.map(cat => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    _count: {
      posts: cat._count.posts
    }
  }));

  const serializedTags = tagsData.map(tag => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    color: tag.color ?? null,
    _count: {
      posts: tag._count.posts
    }
  }));

  // Pick required fields from settings
  const serializedSettings = {
    siteName: blogSettings.siteName,
    siteDescription: blogSettings.siteDescription,
    profile: {
      subtitle: blogSettings.profile.subtitle,
      tagline: blogSettings.profile.tagline,
      bio: blogSettings.profile.bio,
      githubUrl: blogSettings.profile.githubUrl ?? "",
      twitterUrl: blogSettings.profile.twitterUrl ?? ""
    }
  };

  return (
    <FuwariClientPage
      posts={serializedPosts}
      categories={serializedCategories}
      tags={serializedTags}
      settings={serializedSettings}
    />
  );
}
