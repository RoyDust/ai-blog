import { describe, expect, test } from 'vitest'
import { getAdminPathMeta } from '../config'

describe('admin shell config', () => {
  test('maps create-post route into content breadcrumbs', () => {
    expect(getAdminPathMeta('/admin/posts/new')).toEqual({
      currentLabel: '新建文章',
      currentGroup: '内容',
      crumbs: ['后台', '内容', '新建文章'],
    })
  })
})
