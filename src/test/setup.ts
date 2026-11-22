import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

const realSetTimeout = globalThis.setTimeout
const realClearTimeout = globalThis.clearTimeout
let nextRafId = 1
const pendingRafTimers = new Map<number, { timer: ReturnType<typeof globalThis.setTimeout>; clear: typeof globalThis.clearTimeout }>()

function clearPendingRafTimers() {
  for (const { timer, clear } of pendingRafTimers.values()) {
    clear(timer)
  }
  pendingRafTimers.clear()
}

beforeAll(() => {
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

  // 纯 node 环境用例（// @vitest-environment node）没有 window，跳过浏览器 API 打桩
  if (typeof window === 'undefined') {
    return
  }

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
    value: (callback: FrameRequestCallback) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return 0
      }

      const id = nextRafId++
      const scheduleTimeout = globalThis.setTimeout
      const cancelTimeout = globalThis.clearTimeout
      const timer = scheduleTimeout(() => {
        pendingRafTimers.delete(id)
        if (typeof window === 'undefined' || typeof document === 'undefined') {
          return
        }
        callback(performance.now())
      }, 16)
      pendingRafTimers.set(id, { timer, clear: cancelTimeout })
      return id
    },
  })

  Object.defineProperty(window, 'cancelAnimationFrame', {
    writable: true,
    value: (id: number) => {
      const entry = pendingRafTimers.get(id)
      if (entry !== undefined) {
        pendingRafTimers.delete(id)
        entry.clear(entry.timer)
      }
    },
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
// 文件结束前用真实计时器排空队列，并在文件级卸载前清理残留帧句柄，防止 jsdom 拆除后抛出 window/document 未定义。
afterAll(async () => {
  for (let index = 0; index < 5; index += 1) {
    await new Promise<void>((resolve) => realSetTimeout(resolve, 20))
  }
  clearPendingRafTimers()
  void realClearTimeout
})
