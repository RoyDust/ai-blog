const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seedCategories } = require('./seed-categories.cjs');

function fakePrisma(existingBySlug) {
  const calls = { findFirst: [], update: [], create: [] };
  return {
    calls,
    category: {
      async findFirst(args) { calls.findFirst.push(args); return existingBySlug[args.where.slug] ?? null; },
      async update(args) { calls.update.push(args); return { id: args.where.id, slug: 'updated', ...args.data }; },
      async create(args) { calls.create.push(args); return { id: `new-${args.data.slug}`, ...args.data }; },
      async upsert() { throw new Error('upsert on slug is not available: slug is not a Prisma @unique field'); },
    },
  };
}

const catalog = [
  { name: '前端', slug: 'frontend', description: 'UI' },
  { name: '后端', slug: 'backend', description: 'API' },
];

test('creates missing categories and updates active ones by slug without upsert', async () => {
  const prisma = fakePrisma({ frontend: { id: 'cat-1' } });
  const results = await seedCategories(prisma, catalog);

  assert.deepEqual(prisma.calls.findFirst.map((call) => call.where), [
    { slug: 'frontend', deletedAt: null },
    { slug: 'backend', deletedAt: null },
  ]);
  assert.deepEqual(prisma.calls.update, [{ where: { id: 'cat-1' }, data: { name: '前端', description: 'UI' } }]);
  assert.deepEqual(prisma.calls.create, [{ data: { name: '后端', slug: 'backend', description: 'API' } }]);
  assert.equal(results.length, 2);
});

test('ignores soft-deleted rows by only matching deletedAt: null', async () => {
  const prisma = fakePrisma({});
  await seedCategories(prisma, catalog.slice(0, 1));

  assert.equal(prisma.calls.findFirst[0].where.deletedAt, null);
  assert.equal(prisma.calls.update.length, 0);
  assert.equal(prisma.calls.create.length, 1);
});

test('is idempotent: a second run only updates', async () => {
  const store = {};
  const prisma = fakePrisma(store);
  prisma.category.create = async (args) => { store[args.data.slug] = { id: `id-${args.data.slug}` }; prisma.calls.create.push(args); return args.data; };

  await seedCategories(prisma, catalog);
  await seedCategories(prisma, catalog);

  assert.equal(prisma.calls.create.length, 2);
  assert.equal(prisma.calls.update.length, 2);
});

test('exposes the seeding function without touching a database on require', () => {
  assert.equal(typeof seedCategories, 'function');
  assert.equal(process.exitCode, undefined);
});
