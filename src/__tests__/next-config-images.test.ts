import { describe, expect, test } from 'vitest'

import nextConfig from '../../next.config'

describe('next image config', () => {
  test('allows remote images across all configured paths', () => {
    const remotePatterns = nextConfig.images?.remotePatterns ?? []

    expect(remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: 'https',
          hostname: 'project.roydust.top',
          pathname: '/**',
        }),
        expect.objectContaining({
          protocol: 'http',
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

  test('does not always allow trusted image hosts that resolve to local or reserved ips', () => {
    expect(nextConfig.images?.dangerouslyAllowLocalIP).toBe(process.env.NEXT_IMAGE_ALLOW_LOCAL_IP === 'true' || process.env.NODE_ENV !== 'production')
  })

  test('keeps component image quality values within the configured allowlist', () => {
    expect(nextConfig.images?.qualities).toEqual([70, 75])
  })
})
