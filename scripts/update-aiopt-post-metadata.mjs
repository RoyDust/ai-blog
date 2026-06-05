import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mappingPath = path.join(repoRoot, "plan", "aiopt-original-md-times.csv");
const outputDir = path.join(repoRoot, "plan");
const apply = process.argv.includes("--apply");

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

function removeAiPrefix(title) {
  return title.replace(/^【AI优化】\s*/, "").trim();
}

function removeContentH1Prefix(content) {
  return content.replace(/^(#\s*)【AI优化】\s*/m, "$1");
}

function toPgDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const mapping = parseCsv(fs.readFileSync(mappingPath, "utf8"));
const externalIds = mapping.map((row) => row.externalId);
const mappingByExternalId = new Map(mapping.map((row) => [row.externalId, row]));

if (new Set(externalIds).size !== externalIds.length) {
  throw new Error("Duplicate externalId in mapping file");
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const existing = await client.query(
    `
      SELECT
        b."externalId",
        b."postId",
        p."id",
        p."title",
        p."slug",
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

  const foundIds = new Set(existing.rows.map((row) => row.externalId));
  const missing = externalIds.filter((id) => !foundIds.has(id));
  const extraRows = existing.rows.length - foundIds.size;

  if (missing.length > 0 || extraRows !== 0 || existing.rows.length !== externalIds.length) {
    throw new Error(
      `Expected ${externalIds.length} bound posts, found ${existing.rows.length}; missing=${missing.join(";")}; duplicates=${extraRows}`,
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(outputDir, `aiopt-post-db-backup-${timestamp}.json`);
  const resultPath = path.join(outputDir, `aiopt-post-db-update-result-${timestamp}.csv`);
  fs.writeFileSync(backupPath, JSON.stringify(existing.rows, null, 2), "utf8");

  const planned = existing.rows.map((row) => {
    const source = mappingByExternalId.get(row.externalId);
    const nextCreatedAt = toPgDate(source.creationTime);
    const nextTitle = removeAiPrefix(row.title);
    const nextContent = removeContentH1Prefix(row.content);

    return {
      externalId: row.externalId,
      postId: row.postId,
      slug: row.slug,
      sourcePath: source.source_path,
      oldTitle: row.title,
      newTitle: nextTitle,
      oldCreatedAt: row.createdAt,
      newCreatedAt: nextCreatedAt,
      titleChanged: row.title !== nextTitle,
      contentChanged: row.content !== nextContent,
      createdAtChanged: row.createdAt.getTime() !== nextCreatedAt.getTime(),
      published: row.published,
      publishedAt: row.publishedAt,
      nextContent,
    };
  });

  if (apply) {
    await client.query("BEGIN");
    try {
      for (const item of planned) {
        await client.query(
          `
            UPDATE "posts"
            SET
              "title" = $1,
              "content" = $2,
              "createdAt" = $3,
              "updatedAt" = NOW()
            WHERE "id" = $4
          `,
          [item.newTitle, item.nextContent, item.newCreatedAt, item.postId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  const csvLines = [
    [
      "externalId",
      "postId",
      "slug",
      "sourcePath",
      "oldTitle",
      "newTitle",
      "oldCreatedAt",
      "newCreatedAt",
      "titleChanged",
      "contentChanged",
      "createdAtChanged",
      "published",
      "publishedAt",
    ],
    ...planned.map((item) => [
      item.externalId,
      item.postId,
      item.slug,
      item.sourcePath,
      item.oldTitle,
      item.newTitle,
      item.oldCreatedAt.toISOString(),
      item.newCreatedAt.toISOString(),
      String(item.titleChanged),
      String(item.contentChanged),
      String(item.createdAtChanged),
      String(item.published),
      item.publishedAt ? item.publishedAt.toISOString() : "",
    ]),
  ];

  fs.writeFileSync(
    resultPath,
    csvLines
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n"),
    "utf8",
  );

  const summary = {
    mode: apply ? "apply" : "dry-run",
    matched: planned.length,
    titleChanges: planned.filter((item) => item.titleChanged).length,
    contentChanges: planned.filter((item) => item.contentChanged).length,
    createdAtChanges: planned.filter((item) => item.createdAtChanged).length,
    backupPath,
    resultPath,
  };

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await client.end();
}
