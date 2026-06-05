import { describe, expect, test } from 'vitest'
import {
  clampPagination,
  parseAiDraftInput,
  parseCoverAssetInput,
  parseCoverAssetPatchInput,
  parseCoverRandomizeInput,
  parseIdList,
  parseLoginInput,
  parsePostInput,
  parsePostPatchInput,
  parsePublishInput,
  parseRegisterInput,
  parseUploadRequest,
} from '../validation'

describe('validation helpers', () => {
  test('clamps page and limit', () => {
    expect(clampPagination({ page: '0', limit: '500' })).toEqual({ page: 1, limit: 50 })
  })

  test('normalizes invalid and missing pagination values to safe defaults', () => {
    expect(clampPagination({})).toEqual({ page: 1, limit: 10 })
    expect(clampPagination({ page: '-3', limit: '-1' })).toEqual({ page: 1, limit: 1 })
    expect(clampPagination({ page: 'abc', limit: 'NaN' })).toEqual({ page: 1, limit: 10 })
  })

  test('rejects short passwords', () => {
    expect(() => parseRegisterInput({ email: 'a@b.com', password: '123' })).toThrow()
  })

  test('rejects non-string upload filename', () => {
    expect(() => parseUploadRequest({ filename: 123 })).toThrow()
  })

  test('defaults upload purpose to cover and accepts avatar uploads', () => {
    expect(parseUploadRequest({ filename: 'cover.png' })).toMatchObject({
      filename: 'cover.png',
      purpose: 'cover',
    })
    expect(parseUploadRequest({ filename: 'avatar.webp', purpose: 'avatar' })).toMatchObject({
      filename: 'avatar.webp',
      purpose: 'avatar',
    })
  })

  test('rejects unsupported upload purpose values', () => {
    expect(() => parseUploadRequest({ filename: 'avatar.webp', purpose: 'document' })).toThrow()
  })

  test('rejects missing login password', () => {
    expect(() => parseLoginInput({ email: 'a@b.com' })).toThrow()
  })

  test('rejects path-unsafe ai draft externalId values', () => {
    expect(() => parseAiDraftInput({
      externalId: 'article/42',
      title: 'AI Draft',
      slug: 'ai-draft',
      content: 'content',
    })).toThrow()
  })

  test('rejects dot-segment ai draft externalId values', () => {
    expect(() => parseAiDraftInput({
      externalId: '.',
      title: 'AI Draft',
      slug: 'ai-draft',
      content: 'content',
    })).toThrow()

    expect(() => parseAiDraftInput({
      externalId: '..',
      title: 'AI Draft',
      slug: 'ai-draft',
      content: 'content',
    })).toThrow()
  })

  test('parses featured flag in admin post patch input', () => {
    expect(
      parsePostPatchInput({
        title: 'Featured Post',
        slug: 'featured-post',
        content: 'content',
        featured: true,
      }),
    ).toMatchObject({
      featured: true,
    })
  })

  test('parses cover asset creation payloads', () => {
    expect(
      parseCoverAssetInput({
        url: 'https://cdn.example.com/covers/a.jpg',
        key: 'covers/a.jpg',
        title: 'Cover A',
        tags: ['tech', 'tech', 'frontend'],
      }),
    ).toMatchObject({
      url: 'https://cdn.example.com/covers/a.jpg',
      key: 'covers/a.jpg',
      provider: 'qiniu',
      source: 'upload',
      status: 'active',
      title: 'Cover A',
      tags: ['tech', 'frontend'],
    })
  })

  test('rejects non-http cover asset urls', () => {
    expect(() => parseCoverAssetInput({ url: 'ftp://example.com/a.jpg' })).toThrow()
  })

  test('parses cover asset patch and randomize payloads', () => {
    expect(parseCoverAssetPatchInput({ status: 'archived', tags: ['archive'] })).toMatchObject({
      status: 'archived',
      tags: ['archive'],
    })
    expect(parseCoverRandomizeInput({ postIds: ['post-1'], publishedOnly: false })).toEqual({
      postIds: ['post-1'],
      publishedOnly: false,
      replaceExisting: false,
      nonAiDailyOnly: true,
    })
  })

  test('parses coverAssetId in admin post inputs', () => {
    expect(
      parsePostInput({
        title: 'Post',
        slug: 'post',
        content: 'content',
        coverAssetId: 'cover-1',
      }),
    ).toMatchObject({ coverAssetId: 'cover-1' })

    expect(
      parsePostPatchInput({
        title: 'Post',
        slug: 'post',
        content: 'content',
        coverAssetId: 'cover-1',
      }),
    ).toMatchObject({ coverAssetId: 'cover-1' })
  })

  test('rejects past scheduled publish inputs at the parser boundary', () => {
    const realNow = Date.now
    Date.now = () => new Date('2026-05-17T01:00:00.000Z').getTime()

    try {
      expect(() => parsePublishInput({
        id: 'post-1',
        published: false,
        scheduledAt: '2026-05-17T00:59:59.000Z',
      })).toThrow('scheduledAt must be in the future')
    } finally {
      Date.now = realNow
    }
  })

  test('parses bulk publish ids and deduplicates them', () => {
    expect(parsePublishInput({
      ids: ['post-1', 'post-2', 'post-1'],
      published: true,
    })).toMatchObject({
      id: 'post-1',
      ids: ['post-1', 'post-2'],
      published: true,
    })
  })

  test('rejects publish inputs without any post ids', () => {
    expect(() => parsePublishInput({ ids: [], published: true })).toThrow('Post ID is required')
  })

  test('parses comma-separated id lists', () => {
    expect(parseIdList(new URLSearchParams('ids=a,b,c'))).toEqual(['a', 'b', 'c'])
  })

  test('parses repeated id parameters', () => {
    expect(parseIdList(new URLSearchParams('id=a&id=b'))).toEqual(['a', 'b'])
  })

  test('prefers ids over repeated id parameters', () => {
    expect(parseIdList(new URLSearchParams('ids=a,b&id=c'))).toEqual(['a', 'b'])
  })

  test('trims and removes empty id values', () => {
    expect(parseIdList(new URLSearchParams('ids= a, ,b ,, c '))).toEqual(['a', 'b', 'c'])
  })

  test('returns an empty list when no ids are provided', () => {
    expect(parseIdList(new URLSearchParams())).toEqual([])
  })
})
