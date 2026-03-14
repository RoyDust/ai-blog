import { describe, expect, test } from 'vitest'

import nextConfig from '../../next.config'

describe('next image config', () => {
  test('allows remote images across all configured paths', () => {
    const remotePatterns = nextConfig.images?.remotePatterns ?? []

    expect(remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: 'http',
          hostname: 'project.roydust.top',
          pathname: '/**',
        }),
        expect.objectContaining({
          protocol: 'https',
          hostname: 'project.roydust.top',
          pathname: '/**',
        }),
        expect.objectContaining({
          protocol: 'https',
          hostname: 'images.unsplash.com',
          pathname: '/**',
        }),
        expect.objectContaining({
          protocol: 'https',
          hostname: 'avatars.githubusercontent.com',
          pathname: '/**',
        }),
      ]),
    )
  })

  test('allows trusted image hosts that resolve to local or reserved ips', () => {
    expect(nextConfig.images?.dangerouslyAllowLocalIP).toBe(true)
  })
})
