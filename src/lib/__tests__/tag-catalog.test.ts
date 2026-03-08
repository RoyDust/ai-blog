import { expect, test } from 'vitest'
import tagCatalog from '../../../scripts/tag-catalog.json'

test('tag catalog includes common and engineering tags with stable slugs', () => {
  const names = tagCatalog.map((tag) => tag.name)

  expect(names).toEqual(expect.arrayContaining([
    'Next.js',
    'React',
    'TypeScript',
    'Prisma',
    '工程化',
    '前端架构',
    '组件设计',
    '代码规范',
    '测试',
    'CI/CD',
    '可观测性',
  ]))

  expect(tagCatalog.find((tag) => tag.name === 'Next.js')?.slug).toBe('nextjs')
  expect(tagCatalog.find((tag) => tag.name === '前端架构')?.slug).toBe('frontend-architecture')
  expect(tagCatalog.find((tag) => tag.name === 'CI/CD')?.slug).toBe('ci-cd')
})
