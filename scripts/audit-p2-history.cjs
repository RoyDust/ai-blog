// Read-only inventory. The caller must select DATABASE_URL explicitly; no .env is loaded.
const { Pool } = require('pg')

async function auditP2History(connectionString, limit = 1000) {
  if (!connectionString) throw new Error('DATABASE_URL must be explicitly supplied')
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('AUDIT_LIMIT must be between 1 and 10000')
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 })
  let client
  try {
    client = await pool.connect()
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    await client.query("SET LOCAL statement_timeout = '15000ms'")
    async function inventory(query) {
      const total = Number((await client.query('SELECT count(*)::text AS total FROM (' + query + ') audit')).rows[0].total)
      const rows = (await client.query('SELECT * FROM (' + query + ') audit ORDER BY id LIMIT $1', [limit])).rows
      return { total, truncated: total > rows.length, rows }
    }
    const foreignCommentParents = await inventory(`SELECT child.id, child."postId", child."parentId", parent."postId" AS "parentPostId"
      FROM comments child JOIN comments parent ON parent.id = child."parentId" WHERE child."postId" <> parent."postId"`)
    const invalidPostSlugs = await inventory(`SELECT id, slug, "deletedAt" IS NOT NULL AS deleted FROM posts
      WHERE length(slug) > 200 OR slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
    for (const row of invalidPostSlugs.rows) {
      const candidate = row.slug.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200).replace(/-$/, '')
      row.proposedSlug = candidate || null
      row.proposalOnly = true
      row.activeCollision = candidate ? Boolean((await client.query('SELECT 1 FROM posts WHERE slug = $1 AND id <> $2 AND "deletedAt" IS NULL LIMIT 1', [candidate, row.id])).rowCount) : null
    }
    const unappliedAiOutputs = await inventory(`SELECT i.id, i."taskId", i."postId", i.action,
      CASE WHEN t.metadata->>'apply' = 'true' AND i.action IN ('summary','seo-description','cover-image') THEN 'auto_apply_gap_candidate'
        WHEN t.metadata->>'apply' = 'false' OR i.action NOT IN ('summary','seo-description','cover-image') THEN 'suggestion'
        ELSE 'unknown_intent' END AS classification,
      NOT (COALESCE(i."inputSnapshot" ?& ARRAY['contentHash','authorId','published','slug','categorySlug','tagSlugs','seriesSlug'], false)) AS "missingSnapshotEvidence"
      FROM ai_task_items i JOIN ai_tasks t ON t.id = i."taskId" WHERE i.status = 'SUCCEEDED' AND i.applied = false`)
    // to_jsonb keeps this audit usable immediately before the additive Newsletter migration.
    const newsletterManualReview = await inventory(`SELECT c.id, c.status,
      to_jsonb(c)->>'audienceFrozenAt' AS "audienceFrozenAt",
      (SELECT count(*)::int FROM newsletter_deliveries d WHERE d."campaignId" = c.id) AS "deliveryCount",
      CASE WHEN c.status = 'DRAFT' THEN 'draft_with_historical_deliveries'
        WHEN to_jsonb(c)->>'audienceFrozenAt' IS NULL THEN 'audience_not_reconstructible'
        ELSE 'attempt_evidence_missing' END AS reason
      FROM newsletter_campaigns c WHERE
        (c.status <> 'DRAFT' AND to_jsonb(c)->>'audienceFrozenAt' IS NULL)
        OR (c.status = 'DRAFT' AND EXISTS (SELECT 1 FROM newsletter_deliveries d WHERE d."campaignId" = c.id))
        OR EXISTS (SELECT 1 FROM newsletter_deliveries d WHERE d."campaignId" = c.id
          AND d.status IN ('sending','unknown') AND (to_jsonb(d)->>'attemptId' IS NULL OR to_jsonb(d)->>'attemptStartedAt' IS NULL))`)
    await client.query('ROLLBACK')
    return { generatedAt: new Date().toISOString(), readOnly: true, limit, foreignCommentParents, invalidPostSlugs, unappliedAiOutputs, newsletterManualReview }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

module.exports = { auditP2History }
if (require.main === module) {
  auditP2History(process.env.DATABASE_URL, Number(process.env.AUDIT_LIMIT || 1000))
    .then((result) => process.stdout.write(JSON.stringify(result, null, 2) + '\n'))
    .catch(() => { console.error('P2 history audit failed. Check the explicitly selected database, schema and read access.'); process.exitCode = 1 })
}
