import { expect, test } from 'vitest'
import categoryCatalog from '../../../scripts/category-catalog.json'

test('category catalog includes common blog sections with stable slugs', () => {
  const names = categoryCatalog.map((category) => category.name)

  expect(names).toEqual(expect.arrayContaining([
    '前端开发',
    '后端开发',
    '工程实践',
    '性能优化',
    '设计系统',
    '产品与体验',
    '数据库',
    '部署与运维',
  ]))

  expect(categoryCatalog.find((category) => category.name === '前端开发')?.slug).toBe('frontend')
  expect(categoryCatalog.find((category) => category.name === '工程实践')?.slug).toBe('engineering')
  expect(categoryCatalog.find((category) => category.name === '部署与运维')?.slug).toBe('deployment-ops')
})
