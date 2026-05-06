import { NotificationCenterClient } from "@/components/admin/notifications/NotificationCenterClient";
import { PageHeader } from "@/components/admin/primitives/PageHeader";

export const dynamic = "force-dynamic";

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="后台"
        title="通知中心"
        description="集中查看评论、AI 任务和系统状态通知，处理后可标记为已读。"
      />
      <NotificationCenterClient />
    </div>
  );
}
