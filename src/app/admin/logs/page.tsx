import { ApiOperationLogsClient } from "@/components/admin/logs/ApiOperationLogsClient";
import { PageHeader } from "@/components/admin/primitives/PageHeader";

export const dynamic = "force-dynamic";

export default function AdminApiOperationLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统"
        title="接口日志"
        description="查看后台、公开接口、AI 客户端和定时任务的请求结果、耗时、调用方与错误摘要。"
      />
      <ApiOperationLogsClient />
    </div>
  );
}
