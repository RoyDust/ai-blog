import { EmptyState } from "@/components/editorial";

/**
 * 目录页加载失败（简报 16.1）：danger 一句衬线文案 + 描边「重试」，左对齐、无容器。
 * 「重试」用整页刷新的普通链接，服务端页面不需要客户端状态。
 */
export function TaxonomyLoadError({ title, retryHref }: { title: string; retryHref: string }) {
  return (
    <EmptyState
      actions={
        <a className="ed-btn-outline" href={retryHref}>
          重试
        </a>
      }
      role="alert"
      title={title}
      tone="danger"
    />
  );
}
