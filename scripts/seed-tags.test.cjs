const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seedTags } = require('./seed-tags.cjs');

function fakePrisma(existingBySlug) {
  const calls = { findFirst: [], update: [], create: [] };
  return {
    calls,
    tag: {
      async findFirst(args) { calls.findFirst.push(args); return existingBySlug[args.where.slug] ?? null; },
      async update(args) { calls.update.push(args); return { id: args.where.id, slug: 'updated', ...args.data }; },
      async create(args) { calls.create.push(args); return { id: `new-${args.data.slug}`, ...args.data }; },
      async upsert() { throw new Error('upsert on slug is not available: slug is not a Prisma @unique field'); },
    },
  };
}

const catalog = [
  { name: 'React', slug: 'react', color: '#61dafb' },
  { name: 'Prisma', slug: 'prisma', color: '#2d3748' },
];

test('creates missing tags and updates active ones by slug without upsert', async () => {
  const prisma = fakePrisma({ react: { id: 'tag-1' } });
  const results = await seedTags(prisma, catalog);

  assert.deepEqual(prisma.calls.findFirst.map((call) => call.where), [
    { slug: 'react', deletedAt: null },
    { slug: 'prisma', deletedAt: null },
  ]);
  assert.deepEqual(prisma.calls.update, [{ where: { id: 'tag-1' }, data: { name: 'React', color: '#61dafb' } }]);
  assert.deepEqual(prisma.calls.create, [{ data: { name: 'Prisma', slug: 'prisma', color: '#2d3748' } }]);
  assert.equal(results.length, 2);
});

test('ignores soft-deleted rows by only matching deletedAt: null', async () => {
  const prisma = fakePrisma({});
  await seedTags(prisma, catalog.slice(0, 1));

  assert.equal(prisma.calls.findFirst[0].where.deletedAt, null);
  assert.equal(prisma.calls.update.length, 0);
  assert.equal(prisma.calls.create.length, 1);
});

test('is idempotent: a second run only updates', async () => {
  const store = {};
  const prisma = fakePrisma(store);
  prisma.tag.create = async (args) => { store[args.data.slug] = { id: `id-${args.data.slug}` }; prisma.calls.create.push(args); return args.data; };

  await seedTags(prisma, catalog);
  await seedTags(prisma, catalog);

  assert.equal(prisma.calls.create.length, 2);
  assert.equal(prisma.calls.update.length, 2);
});

test('exposes the seeding function without touching a database on require', () => {
  assert.equal(typeof seedTags, 'function');
  assert.equal(process.exitCode, undefined);
});
