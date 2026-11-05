import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

beforeAll(() => {
  process.env.NEXTAUTH_URL = 'http://47.98.167.32'
  process.env.NEXT_PUBLIC_SITE_URL = 'http://47.98.167.32'

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    // 实现直接传给 vi.fn：restoreAllMocks / mockRestore 会还原到这个实现，而不是清空
    // （motion 的 useReducedMotion 依赖 matchMedia，被清空后组件会抛错）
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(window, 'requestAnimationFrame', {
    writable: true,
    value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16),
  })

  Object.defineProperty(window, 'cancelAnimationFrame', {
    writable: true,
    value: (id: number) => window.clearTimeout(id),
  })

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  class IntersectionObserverMock {
    root = null
    rootMargin = ''
    thresholds = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  })

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: IntersectionObserverMock,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// motion 的布局投影（layoutId 下划线 / 指示条）会在卸载后再排一帧去测量滚动位置。
// 若测试文件结束时这帧还没跑，它会在 jsdom 拆除后执行并抛出「document is not defined」
// 未处理异常（vitest 会因此判失败）。文件结束前用真实计时器等待几帧，让排队的帧在环境仍在时跑完。
const realSetTimeout = globalThis.setTimeout

afterAll(async () => {
  for (let index = 0; index < 3; index += 1) {
    await new Promise<void>((resolve) => realSetTimeout(resolve, 20))
  }
})
