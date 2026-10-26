import { describe, expect, test } from 'vitest'

import { extractCompletionUsage } from '@/lib/completion-usage'

describe('extractCompletionUsage', () => {
  test('reads prompt, completion, reasoning and cache usage without treating missing fields as zero', () => {
    expect(extractCompletionUsage({
      usage: {
        prompt_tokens: 120,
        completion_tokens: 44,
        total_tokens: 164,
        completion_tokens_details: { reasoning_tokens: 31 },
        prompt_cache_hit_tokens: 16,
        prompt_cache_miss_tokens: 104,
      },
    })).toEqual({
      prompt_tokens: 120,
      completion_tokens: 44,
      total_tokens: 164,
      reasoning_tokens: 31,
      prompt_cache_hit_tokens: 16,
      prompt_cache_miss_tokens: 104,
    })
    expect(extractCompletionUsage({ usage: { prompt_tokens: 7 } })).toEqual({
      prompt_tokens: 7,
      completion_tokens: null,
      total_tokens: null,
      reasoning_tokens: null,
      prompt_cache_hit_tokens: null,
      prompt_cache_miss_tokens: null,
    })
    expect(extractCompletionUsage({ choices: [] })).toBeNull()
    expect(extractCompletionUsage({ usage: { total_tokens: -1, completion_tokens: 2.5 } })).toMatchObject({
      total_tokens: null,
      completion_tokens: null,
    })
  })
})
