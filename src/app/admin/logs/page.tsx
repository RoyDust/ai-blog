import { ApiOperationLogsClient } from "@/components/admin/logs/ApiOperationLogsClient";
import { PageHeader } from "@/components/admin/primitives/PageHeader";

export const dynamic = "force-dynamic";

/** 接口日志（方向 A 第 14 节）：固定高度纸面，页头 → 指标条 → 区块标题 → 筛选行 → 表格（内部滚动、表头吸顶）→ 分页 */
export default function AdminApiOperationLogsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden max-lg:overflow-y-auto">
      <PageHeader
        className="shrink-0"
        description="查看后台、公开接口、AI 客户端和定时任务的请求结果、耗时、调用方与错误摘要。"
        eyebrow="系统"
        title="接口日志"
      />
      <ApiOperationLogsClient />
    </div>
  );
}
