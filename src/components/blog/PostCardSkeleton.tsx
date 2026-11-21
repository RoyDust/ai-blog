import { ListRowSkeleton } from "@/components/editorial";

/**
 * 列表行骨架：与真实行同尺寸的细条（简报 16.1）。保留旧组件名，供列表页与 Suspense 回退复用。
 */
export function PostCardSkeleton({ count = 1 }: { count?: number }) {
  return <ListRowSkeleton count={count} />;
}
