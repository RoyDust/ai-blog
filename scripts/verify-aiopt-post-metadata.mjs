import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mappingPath = path.join(repoRoot, "plan", "aiopt-original-md-times.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...dataRows] = rows.filter((item) => item.length > 1 || item[0] !== "");
  return dataRows.map((item) => Object.fromEntries(header.map((key, index) => [key, item[index] ?? ""])));
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const mapping = parseCsv(fs.readFileSync(mappingPath, "utf8"));
const externalIds = mapping.map((row) => row.externalId);
const expectedByExternalId = new Map(mapping.map((row) => [row.externalId, new Date(row.creationTime)]));

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const result = await client.query(
    `
      SELECT
        b."externalId",
        p."id",
        p."title",
        p."content",
        p."createdAt",
        p."updatedAt",
        p."publishedAt",
        p."published"
      FROM "ai_draft_bindings" b
      JOIN "posts" p ON p."id" = b."postId"
      WHERE b."externalId" = ANY($1::text[])
      ORDER BY b."externalId" ASC
    `,
    [externalIds],
  );

  const errors = [];
  for (const row of result.rows) {
    const expectedDate = expectedByExternalId.get(row.externalId);
    const firstHeading = row.content.match(/^#\s+(.+)$/m)?.[1] ?? "";

    if (row.title.includes("【AI优化】")) {
      errors.push(`${row.externalId}: title still has prefix`);
    }
    if (firstHeading.includes("【AI优化】")) {
      errors.push(`${row.externalId}: content H1 still has prefix`);
    }
    if (row.createdAt.getTime() !== expectedDate.getTime()) {
      errors.push(`${row.externalId}: createdAt mismatch ${row.createdAt.toISOString()} != ${expectedDate.toISOString()}`);
    }
  }

  const sample = result.rows.slice(0, 5).map((row) => ({
    externalId: row.externalId,
    title: row.title,
    firstHeading: row.content.match(/^#\s+(.+)$/m)?.[1] ?? "",
    createdAt: row.createdAt.toISOString(),
    published: row.published,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  }));

  console.log(JSON.stringify({
    checked: result.rows.length,
    errors: errors.length,
    errorList: errors,
    sample,
  }, null, 2));
} finally {
  await client.end();
}
