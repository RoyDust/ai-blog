import { PostList } from '@/components/posts';
import { Header, Footer, Sidebar } from '@/components/layout';

// 模拟数据 - 实际项目中从 API 获取
const mockPosts = [
  {
    slug: 'getting-started-with-nextjs',
    title: 'Getting Started with Next.js 16',
    excerpt: 'Learn how to build modern web applications with Next.js 16 and its new App Router architecture.',
    coverImage: 'https://picsum.photos/seed/nextjs/800/400',
    author: { name: 'John Doe' },
    publishedAt: '2024-01-15T10:00:00Z',
    category: 'Next.js',
  },
  {
    slug: 'typescript-best-practices',
    title: 'TypeScript Best Practices in 2024',
    excerpt: 'Discover the best practices for writing clean, maintainable TypeScript code.',
    coverImage: 'https://picsum.photos/seed/typescript/800/400',
    author: { name: 'Jane Smith' },
    publishedAt: '2024-01-10T10:00:00Z',
    category: 'TypeScript',
  },
  {
    slug: 'css-tailwind-tips',
    title: 'Tailwind CSS Tips and Tricks',
    excerpt: 'Master Tailwind CSS with these useful tips and tricks for efficient styling.',
    coverImage: 'https://picsum.photos/seed/tailwind/800/400',
    author: { name: 'John Doe' },
    publishedAt: '2024-01-05T10:00:00Z',
    category: 'CSS',
  },
  {
    slug: 'react-hooks-guide',
    title: 'Complete Guide to React Hooks',
    excerpt: 'Everything you need to know about React Hooks and how to use them effectively.',
    coverImage: 'https://picsum.photos/seed/react/800/400',
    author: { name: 'Jane Smith' },
    publishedAt: '2024-01-01T10:00:00Z',
    category: 'React',
  },
];

const mockCategories = [
  { name: 'Next.js', slug: 'nextjs', count: 5 },
  { name: 'TypeScript', slug: 'typescript', count: 8 },
  { name: 'React', slug: 'react', count: 12 },
  { name: 'CSS', slug: 'css', count: 6 },
];

const mockRecentPosts = [
  { title: 'Getting Started with Next.js 16', slug: 'getting-started-with-nextjs' },
  { title: 'TypeScript Best Practices in 2024', slug: 'typescript-best-practices' },
  { title: 'Tailwind CSS Tips and Tricks', slug: 'css-tailwind-tips' },
];

interface PageProps {
  searchParams: Promise<{ page?: string; category?: string }>;
}

export default async function PostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentPage = parseInt(params.page || '1', 10);
  const category = params.category;

  // 模拟分页
  const postsPerPage = 6;
  const totalPosts = mockPosts.length;
  const totalPages = Math.ceil(totalPosts / postsPerPage);

  const startIndex = (currentPage - 1) * postsPerPage;
  const paginatedPosts = mockPosts.slice(startIndex, startIndex + postsPerPage);

  return (
    <>
      <Header siteName="My Blog" />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Blog Posts
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Explore our latest articles and tutorials
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <PostList
              posts={paginatedPosts.map((post) => ({
                ...post,
                author: { name: post.author.name },
              }))}
              pagination={{
                currentPage,
                totalPages,
                baseUrl: category ? `?category=${category}&page=` : '?page=',
              }}
            />
          </div>

          <div className="lg:col-span-1">
            <Sidebar
              categories={mockCategories}
              recentPosts={mockRecentPosts}
            />
          </div>
        </div>
      </main>
      <Footer copyright="My Blog" />
    </>
  );
}
