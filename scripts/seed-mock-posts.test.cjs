const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seedMockPosts } = require('./seed-mock-posts.cjs');

function createFakePrisma({
  author = { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
  categories = [{ id: 'cat-frontend', slug: 'frontend', deletedAt: null }],
  tags = [
    { id: 'tag-react', slug: 'react', deletedAt: null },
    { id: 'tag-nextjs', slug: 'nextjs', deletedAt: null },
  ],
  posts = [],
} = {}) {
  const state = {
    posts: posts.map((post) => ({ ...post })),
  };
  const calls = {
    categoryFindFirst: [],
    tagFindMany: [],
    postFindFirst: [],
    postUpdate: [],
    postCreate: [],
  };

  return {
    state,
    calls,
    user: {
      async findFirst() {
        return author;
      },
    },
    category: {
      async findFirst(args) {
        calls.categoryFindFirst.push(args);
        const match = categories.find(
          (row) =>
            row.slug === args.where.slug &&
            (args.where.deletedAt === null ? row.deletedAt == null : true),
        );
        return match ? { id: match.id } : null;
      },
      async findUnique() {
        throw new Error('category.findUnique on slug is forbidden: slug uses a partial unique index');
      },
    },
    tag: {
      async findMany(args) {
        calls.tagFindMany.push(args);
        const slugSet = new Set(args.where.slug.in);
        return tags
          .filter(
            (row) =>
              slugSet.has(row.slug) &&
              (args.where.deletedAt === null ? row.deletedAt == null : true),
          )
          .map((row) => ({ id: row.id, slug: row.slug }));
      },
    },
    post: {
      async findFirst(args) {
        calls.postFindFirst.push(args);
        const match = state.posts.find(
          (row) =>
            row.slug === args.where.slug &&
            (args.where.deletedAt === null ? row.deletedAt == null : true),
        );
        return match ? { id: match.id } : null;
      },
      async update(args) {
        calls.postUpdate.push(args);
        const index = state.posts.findIndex((row) => row.id === args.where.id);
        const updated = { ...state.posts[index], ...args.data, id: args.where.id };
        state.posts[index] = updated;
        return updated;
      },
      async create(args) {
        calls.postCreate.push(args);
        const created = {
          id: `new-${state.posts.length + 1}-${args.data.slug}`,
          deletedAt: null,
          ...args.data,
        };
        state.posts.push(created);
        return created;
      },
      async upsert() {
        throw new Error('post.upsert on slug is forbidden: slug is not a Prisma @unique field');
      },
    },
  };
}

const sampleCatalog = [
  {
    title: '第一篇示例文章',
    slug: 'mock-post-one',
    coverImage: 'https://example.com/1.png',
    viewCount: 100,
    excerpt: '摘要一',
    content: '# 正文一',
    categorySlug: 'frontend',
    tagSlugs: ['react', 'nextjs'],
    publishedAt: '2026-02-10T08:00:00.000Z',
  },
  {
    title: '第二篇示例文章',
    slug: 'mock-post-two',
    coverImage: 'https://example.com/2.png',
    viewCount: 200,
    excerpt: '摘要二',
    content: '# 正文二',
    categorySlug: 'frontend',
    tagSlugs: ['react'],
    publishedAt: '2026-02-12T08:00:00.000Z',
  },
];

test('creates missing posts and updates active ones by id without calling upsert or category.findUnique', async () => {
  const prisma = createFakePrisma({
    posts: [{ id: 'active-post-1', slug: 'mock-post-one', deletedAt: null }],
  });

  const results = await seedMockPosts(prisma, sampleCatalog);

  assert.equal(results.length, 2);
  assert.deepEqual(
    prisma.calls.postFindFirst.map((call) => call.where),
    [
      { slug: 'mock-post-one', deletedAt: null },
      { slug: 'mock-post-two', deletedAt: null },
    ],
  );
  assert.equal(prisma.calls.postUpdate.length, 1);
  assert.equal(prisma.calls.postUpdate[0].where.id, 'active-post-1');
  assert.equal(prisma.calls.postCreate.length, 1);
  assert.equal(prisma.calls.postCreate[0].data.slug, 'mock-post-two');
});

test('does not collide with soft-deleted posts, categories, or tags sharing the same slug', async () => {
  const prisma = createFakePrisma({
    categories: [
      { id: 'cat-deleted', slug: 'frontend', deletedAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'cat-active', slug: 'frontend', deletedAt: null },
    ],
    tags: [
      { id: 'tag-react-deleted', slug: 'react', deletedAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'tag-react-active', slug: 'react', deletedAt: null },
      { id: 'tag-nextjs-active', slug: 'nextjs', deletedAt: null },
    ],
    posts: [
      { id: 'deleted-post-1', slug: 'mock-post-one', deletedAt: new Date('2026-01-05T00:00:00Z') },
    ],
  });

  const results = await seedMockPosts(prisma, sampleCatalog.slice(0, 1));

  assert.equal(prisma.calls.postUpdate.length, 0);
  assert.equal(prisma.calls.postCreate.length, 1);
  assert.equal(results[0].categoryId, 'cat-active');
  assert.deepEqual(results[0].tags, {
    connect: [{ id: 'tag-react-active' }, { id: 'tag-nextjs-active' }],
  });
  assert.equal(prisma.state.posts.length, 2);
});

test('is idempotent: a second run updates existing active posts without creating duplicates', async () => {
  const prisma = createFakePrisma();

  await seedMockPosts(prisma, sampleCatalog);
  await seedMockPosts(prisma, sampleCatalog);

  assert.equal(prisma.calls.postCreate.length, 2);
  assert.equal(prisma.calls.postUpdate.length, 2);
  assert.equal(prisma.state.posts.length, 2);
});

test('exposes seedMockPosts without touching a database on require', () => {
  assert.equal(typeof seedMockPosts, 'function');
  assert.equal(process.exitCode, undefined);
});
