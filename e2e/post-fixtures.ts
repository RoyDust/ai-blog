import { Pool, type PoolClient } from 'pg'

/** Physical deletion is available only in an explicitly selected disposable test database. */
export async function purgeOwnedPost(id: string, slug: string) {
  const url = process.env.DATABASE_URL
  if (process.env.E2E_DISPOSABLE_DATABASE !== '1' || !url || !/(_test|_p2)$/.test(new URL(url).pathname)) {
    throw new Error('Post fixture cleanup requires E2E_DISPOSABLE_DATABASE=1 and a database ending in _test or _p2')
  }
  const pool = new Pool({ connectionString: url })
  let client: PoolClient | undefined
  try {
    client = await pool.connect()
    const deadline = Date.now() + 180000
    while (true) {
      const active = await client.query('SELECT 1 FROM ai_tasks t JOIN ai_task_items i ON i."taskId" = t.id WHERE i."postId" = $1 AND t.status IN (\'QUEUED\', \'RUNNING\')', [id])
      if (!active.rowCount) break
      if (Date.now() > deadline) throw new Error('Owned post still has active AI work; refusing physical cleanup')
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    await client.query('BEGIN')
    const owned = await client.query('SELECT id FROM posts WHERE id = $1 AND slug = $2 FOR UPDATE', [id, slug])
    if (owned.rowCount !== 1) throw new Error('Owned E2E post identity no longer matches')
    const tasks = await client.query<{ id: string }>('SELECT t.id FROM ai_tasks t WHERE EXISTS (SELECT 1 FROM ai_task_items i WHERE i."taskId" = t.id AND i."postId" = $1) AND NOT EXISTS (SELECT 1 FROM ai_task_items i WHERE i."taskId" = t.id AND i."postId" IS DISTINCT FROM $1)', [id])
    const taskIds = tasks.rows.map((task) => task.id)
    await client.query('DELETE FROM notifications WHERE ("entityType" = \'aiTask\' AND "entityId" = ANY($1::text[])) OR ("entityType" = \'post\' AND "entityId" = $2)', [taskIds, id])
    await client.query('DELETE FROM ai_tasks WHERE id = ANY($1::text[])', [taskIds])
    await client.query('DELETE FROM posts WHERE id = $1', [id])
    await client.query('COMMIT')
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK') } catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Post fixture cleanup and rollback failed') }
    }
    throw error
  } finally { client?.release(); await pool.end() }
}
