import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { SWRConfig, mutate as clearSwrCache } from "swr";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { apiFetcher, apiMutate } from "@/lib/client-api";

import EditPostPage from "../page";

const pushMock = vi.hoisted(() => vi.fn());
const backMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock("@/components/posts", () => ({
  EditorWorkspace: ({
    title,
    slug,
    content,
    excerpt,
    coverImage,
    onTitleChange,
    onSlugChange,
    onContentChange,
    onExcerptChange,
    onCoverImageChange,
  }: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    coverImage: string;
    onTitleChange: (value: string) => void;
    onSlugChange: (value: string) => void;
    onContentChange: (value: string) => void;
    onExcerptChange: (value: string) => void;
    onCoverImageChange: (value: string) => void;
  }) => (
    <section>
      <label>
        标题
        <input aria-label="标题" value={title} onChange={(event) => onTitleChange(event.target.value)} />
      </label>
      <label>
        Slug
        <input aria-label="Slug" value={slug} onChange={(event) => onSlugChange(event.target.value)} />
      </label>
      <label>
        内容
        <textarea aria-label="内容" value={content} onChange={(event) => onContentChange(event.target.value)} />
      </label>
      <label>
        摘要
        <input aria-label="摘要" value={excerpt} onChange={(event) => onExcerptChange(event.target.value)} />
      </label>
      <label>
        封面图 URL
        <input aria-label="封面图 URL" value={coverImage} onChange={(event) => onCoverImageChange(event.target.value)} />
      </label>
    </section>
  ),
  PublishChecklist: ({ title, slug, content }: { title: string; slug: string; content: string }) => (
    <aside>发布清单：{title}-{slug}-{content.length}</aside>
  ),
}));

vi.mock("@/lib/client-api", () => ({
  apiFetcher: vi.fn(),
  apiMutate: vi.fn(),
  toErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const apiFetcherMock = vi.mocked(apiFetcher);
const apiMutateMock = vi.mocked(apiMutate);

async function renderEditPage(slug = "old-post") {
  const params = Promise.resolve({ slug });
  let result: ReturnType<typeof render> | undefined;

  await act(async () => {
    result = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Suspense fallback={<p>正在加载编辑器...</p>}>
          <EditPostPage params={params} />
        </Suspense>
      </SWRConfig>,
    );
  });

  return result!;
}

function loadedPost(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      title: "服务端标题",
      slug: "server-post",
      content: "服务端正文",
      excerpt: "服务端摘要",
      coverImage: "https://example.com/server.jpg",
      published: false,
      ...overrides,
    },
  };
}

describe("EditPostPage", () => {
  beforeEach(async () => {
    await clearSwrCache(() => true, undefined, { revalidate: false });
    window.localStorage.clear();
    apiFetcherMock.mockReset();
    apiMutateMock.mockReset();
    pushMock.mockReset();
    backMock.mockReset();
  });

  test("shows loading while the post request is pending", async () => {
    apiFetcherMock.mockReturnValue(new Promise(() => undefined));

    await renderEditPage();

    expect(screen.getByText("正在加载编辑器...")).toBeInTheDocument();
    expect(apiFetcherMock).toHaveBeenCalledWith("/api/posts/old-post");
  });

  test("loads the post through apiFetcher", async () => {
    apiFetcherMock.mockResolvedValue(loadedPost());

    await renderEditPage();

    expect(await screen.findByLabelText("标题")).toHaveValue("服务端标题");
    expect(apiFetcherMock).toHaveBeenCalledWith("/api/posts/old-post");
  });

  test("restores a local edit draft over server data", async () => {
    apiFetcherMock.mockResolvedValue(loadedPost());
    window.localStorage.setItem(
      "author:draft:edit:old-post",
      JSON.stringify({
        title: "草稿标题",
        slug: "draft-post",
        content: "草稿正文",
        excerpt: "草稿摘要",
        coverImage: "https://example.com/draft.jpg",
        published: true,
      }),
    );

    await renderEditPage();

    expect(await screen.findByLabelText("标题")).toHaveValue("草稿标题");
    expect(screen.getByLabelText("Slug")).toHaveValue("draft-post");
    expect(screen.getByLabelText("发布文章")).toBeChecked();
  });

  test("validates required fields before saving", async () => {
    apiFetcherMock.mockResolvedValue(loadedPost({ title: "", slug: "", content: "" }));

    await renderEditPage();

    await screen.findByLabelText("标题");
    fireEvent.submit(screen.getByRole("button", { name: "保存修改" }).closest("form")!);

    expect(await screen.findByText("请输入标题")).toBeInTheDocument();
    expect(screen.getByText("请输入 Slug")).toBeInTheDocument();
    expect(screen.getByText("请输入正文")).toBeInTheDocument();
    expect(apiMutateMock).not.toHaveBeenCalled();
  });

  test("saves through apiMutate, clears draft, and redirects to the edited slug", async () => {
    apiFetcherMock.mockResolvedValue(loadedPost());
    apiMutateMock.mockResolvedValue({ success: true });
    window.localStorage.setItem("author:draft:edit:old-post", JSON.stringify(loadedPost().data));

    await renderEditPage();

    fireEvent.change(await screen.findByLabelText("标题"), { target: { value: "更新标题" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "updated-post" } });
    fireEvent.submit(screen.getByRole("button", { name: "保存修改" }).closest("form")!);

    await waitFor(() => {
      expect(apiMutateMock).toHaveBeenCalledWith(
        "/api/posts/old-post",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            title: "更新标题",
            slug: "updated-post",
            content: "服务端正文",
            excerpt: "服务端摘要",
            coverImage: "https://example.com/server.jpg",
            published: false,
          }),
        }),
      );
    });
    expect(window.localStorage.getItem("author:draft:edit:old-post")).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/posts/updated-post");
  });

  test("shows save errors without clearing the local draft", async () => {
    apiFetcherMock.mockResolvedValue(loadedPost());
    apiMutateMock.mockRejectedValue(new Error("Slug 已存在"));

    await renderEditPage();

    fireEvent.submit((await screen.findByRole("button", { name: "保存修改" })).closest("form")!);

    expect(await screen.findByText("Slug 已存在")).toBeInTheDocument();
    expect(window.localStorage.getItem("author:draft:edit:old-post")).toContain("服务端标题");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
