import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * 契约测试：软删除 × 唯一约束修复的迁移与 schema 必须保持一致。
 *
 * 约束：
 * - 迁移必须把 8 个"全局唯一索引"替换为"仅 active 行唯一"的部分唯一索引；
 * - schema.prisma 中对应字段不得再声明 @unique（部分唯一索引无法用 Prisma 声明）；
 * - 若未来 prisma db pull 或手改把 @unique 加回，本测试会失败提醒。
 */
const migrationSql = readFileSync(
  path.join(process.cwd(), "prisma", "migrations", "202608150001_soft_delete_partial_unique_indexes", "migration.sql"),
  "utf8",
);
const schemaPrisma = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");

const PARTIAL_UNIQUE_INDEXES = [
  { table: "posts", column: "slug" },
  { table: "series", column: "slug" },
  { table: "categories", column: "name" },
  { table: "categories", column: "slug" },
  { table: "tags", column: "name" },
  { table: "tags", column: "slug" },
  { table: "topic_guides", column: "slug" },
  { table: "cover_assets", column: "url" },
] as const;

describe("soft-delete partial unique index migration", () => {
  test("creates a partial unique index for every soft-deleted unique field", () => {
    for (const { table, column } of PARTIAL_UNIQUE_INDEXES) {
      const expected = `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_${column}_active_unique" ON "${table}" ("${column}") WHERE "deletedAt" IS NULL;`;
      expect(migrationSql, `missing partial unique index for ${table}.${column}`).toContain(expected);
    }
  });

  test("drops the legacy global unique indexes", () => {
    for (const { table, column } of PARTIAL_UNIQUE_INDEXES) {
      const expected = `DROP INDEX IF EXISTS "${table}_${column}_key";`;
      expect(migrationSql, `missing DROP INDEX for ${table}.${column}`).toContain(expected);
    }
  });

  test("keeps plain indexes for slug / url lookups", () => {
    const expected = [
      `CREATE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" ("slug");`,
      `CREATE INDEX IF NOT EXISTS "series_slug_idx" ON "series" ("slug");`,
      `CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");`,
      `CREATE INDEX IF NOT EXISTS "tags_slug_idx" ON "tags" ("slug");`,
      `CREATE INDEX IF NOT EXISTS "topic_guides_slug_idx" ON "topic_guides" ("slug");`,
      `CREATE INDEX IF NOT EXISTS "cover_assets_url_idx" ON "cover_assets" ("url");`,
    ];
    for (const statement of expected) {
      expect(migrationSql).toContain(statement);
    }
  });

  test("schema no longer declares @unique on soft-deleted unique fields", () => {
    // 这些 @unique 声明一旦被加回，Prisma 会重新生成全局唯一约束，
    // 与本迁移的部分唯一索引语义冲突。按模型块精确断言，避免误伤
    // 仍保留 @unique 的非软删模型（如 AiTopic.slug）。
    function extractModel(source: string, modelName: string) {
      const match = source.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
      return match?.[1] ?? "";
    }

    const softDeletedModels = ["Post", "Series", "Category", "Tag", "TopicGuide", "CoverAsset"] as const;
    for (const modelName of softDeletedModels) {
      const block = extractModel(schemaPrisma, modelName);
      expect(block, `model ${modelName} block not found`).not.toBe("");
      expect(block, `model ${modelName} must not declare slug/name/url @unique`).not.toMatch(/^\s*(slug|name|url)\s+String\s+@unique/m);
    }

    // 仍保留 @unique 的非软删字段不受影响（防误删）。
    expect(extractModel(schemaPrisma, "User")).toMatch(/^\s*email\s+String\s+@unique/m);
    expect(extractModel(schemaPrisma, "AiTopic")).toMatch(/^\s*slug\s+String\s+@unique/m);
  });
});
