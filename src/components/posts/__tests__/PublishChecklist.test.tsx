import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { PublishChecklist } from '../PublishChecklist'

describe('PublishChecklist', () => {
  test('surfaces SEO readiness checks before publishing', () => {
    render(
      <PublishChecklist
        title="一篇足够长的标题"
        slug="bad slug"
        content="短正文"
        coverImage=""
        excerpt=""
        seoDescription="太短"
        variant="inline"
      />,
    )

    expect(screen.getByText('Slug URL 安全')).toBeInTheDocument()
    expect(screen.getByText('摘要或 SEO 描述已填写')).toBeInTheDocument()
    expect(screen.getByText('SEO 描述长度适中')).toBeInTheDocument()
    expect(screen.getByText(/完成 \d+\/7 项后更适合直接发布。/)).toBeInTheDocument()
  })
})
