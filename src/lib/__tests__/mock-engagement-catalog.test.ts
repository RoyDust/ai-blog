import { expect, test } from 'vitest'
import engagementCatalog from '../../../scripts/mock-engagement-catalog.json'

test('mock engagement catalog includes comments and likes for seeded posts', () => {
  expect(engagementCatalog.length).toBeGreaterThanOrEqual(8)

  for (const item of engagementCatalog) {
    expect(typeof item.postSlug).toBe('string')
    expect(item.postSlug.length).toBeGreaterThan(0)
    expect(item.likes).toBeGreaterThanOrEqual(2)
    expect(item.comments.length).toBeGreaterThanOrEqual(2)
    for (const comment of item.comments) {
      expect(comment.content.length).toBeGreaterThan(10)
    }
  }
})
