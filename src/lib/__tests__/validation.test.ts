import { describe, expect, test } from 'vitest'
import {
  clampPagination,
  parseLoginInput,
  parseRegisterInput,
  parseUploadRequest,
} from '../validation'

describe('validation helpers', () => {
  test('clamps page and limit', () => {
    expect(clampPagination({ page: '0', limit: '500' })).toEqual({ page: 1, limit: 50 })
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
})
