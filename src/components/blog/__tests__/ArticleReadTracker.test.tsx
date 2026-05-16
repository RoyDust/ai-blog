import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ArticleReadTracker } from "@/components/blog/ArticleReadTracker";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  status: "authenticated",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerMocks.refresh,
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: authMocks.status === "authenticated" ? { user: { id: "user-1" } } : null,
    status: authMocks.status,
  }),
}));

function mockFetch() {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function setVisibleDocument() {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
}

function setScrollMetrics({ scrollHeight, innerHeight, scrollY }: { scrollHeight: number; innerHeight: number; scrollY: number }) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  });
}

describe("ArticleReadTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    routerMocks.refresh.mockClear();
    authMocks.status = "authenticated";
    window.sessionStorage.clear();
    setVisibleDocument();
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 0 });
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("records a qualified read after visible reading time reaches the threshold", async () => {
    const fetchMock = mockFetch();

    render(<ArticleReadTracker postId="post-1" />);

    act(() => {
      vi.advanceTimersByTime(19_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/reading-events", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        postId: "post-1",
        durationSeconds: 20,
        scrollDepth: 0,
      }),
      keepalive: true,
    }));
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });

  test("records a qualified read when scroll depth reaches the threshold", async () => {
    const fetchMock = mockFetch();

    render(<ArticleReadTracker postId="post-1" />);

    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 400 });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/reading-events", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        postId: "post-1",
        durationSeconds: 0,
        scrollDepth: 40,
      }),
      keepalive: true,
    }));
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });

  test("does not record more than once in one page lifecycle", () => {
    const fetchMock = mockFetch();

    render(<ArticleReadTracker postId="post-1" />);

    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 400 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(25_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not refresh the route when the reading event request fails", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })));
    vi.stubGlobal("fetch", fetchMock);

    render(<ArticleReadTracker postId="post-1" />);

    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 400 });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });

  test("does not record again after a successful read refresh marks the article in the current tab", async () => {
    const fetchMock = mockFetch();
    const { unmount } = render(<ArticleReadTracker postId="post-1" />);

    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 400 });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(routerMocks.refresh).toHaveBeenCalledOnce();

    unmount();
    render(<ArticleReadTracker postId="post-1" />);

    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(25_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });

  test("does not start reading event tracking for anonymous users", () => {
    authMocks.status = "unauthenticated";
    const fetchMock = mockFetch();

    render(<ArticleReadTracker postId="post-1" />);

    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 400 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(25_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });
});
