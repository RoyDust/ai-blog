interface FilterablePost {
  title: string
  excerpt: string | null
  category: { slug: string } | null
  tags: Array<{ slug: string }>
}

interface PostFilters {
  search: string
  category: string
  tag: string
}

export function filterPosts<T extends FilterablePost>(posts: T[], filters: PostFilters) {
  const search = filters.search.trim().toLowerCase()

  return posts.filter((post) => {
    const matchesSearch =
      !search ||
      post.title.toLowerCase().includes(search) ||
      (post.excerpt ?? '').toLowerCase().includes(search)

    const matchesCategory = !filters.category || post.category?.slug === filters.category
    const matchesTag = !filters.tag || post.tags.some((tag) => tag.slug === filters.tag)

    return matchesSearch && matchesCategory && matchesTag
  })
}
