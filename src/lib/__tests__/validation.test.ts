import { describe, expect, test } from 'vitest'
import {
  clampPagination,
  parseAiDraftInput,
  parseLoginInput,
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
})
