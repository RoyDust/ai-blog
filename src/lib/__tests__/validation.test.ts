import { describe, expect, test } from 'vitest'
import {
  clampPagination,
  parseAiDraftInput,
  parseCoverAssetInput,
  parseCoverAssetPatchInput,
  parseCoverRandomizeInput,
  parseLoginInput,
  parsePostInput,
  parsePostPatchInput,
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
})
