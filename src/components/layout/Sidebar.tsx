import Link from 'next/link';

export interface SidebarProps {
  categories?: Array<{ name: string; slug: string; count: number }>;
  recentPosts?: Array<{ title: string; slug: string }>;
}

export function Sidebar({ categories = [], recentPosts = [] }: SidebarProps) {
  return (
    <aside className="space-y-8">
      {categories.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Categories
          </h3>
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/category/${category.slug}`}
                  className="flex items-center justify-between text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <span>{category.name}</span>
                  <span className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {category.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentPosts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Posts
          </h3>
          <ul className="space-y-3">
            {recentPosts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/posts/${post.slug}`}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Newsletter
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Subscribe to get the latest posts delivered to your inbox.
        </p>
        <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Subscribe
          </button>
        </form>
      </div>
    </aside>
  );
}
