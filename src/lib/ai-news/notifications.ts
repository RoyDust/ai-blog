import { formatDateId } from "@/lib/ai-news/parser";
import type { DailyAiNewsRunResult } from "@/lib/ai-news/run/entry";
import { createAdminNotification, NOTIFICATION_SEVERITIES, NOTIFICATION_TYPES } from "@/lib/notifications";

export async function notifyDailyAiNewsSuccess(result: DailyAiNewsRunResult, date: Date) {
  if (result.operation === "skipped") {
    return;
  }

  const { post, published } = result;
  const runId = result.run.id;

  try {
    await createAdminNotification({
      type: NOTIFICATION_TYPES.aiNewsSucceeded,
      severity: NOTIFICATION_SEVERITIES.success,
      title: published ? "AI 日报已上线" : "AI 日报草稿已生成",
      body: post.title ? `《${post.title}》已生成${published ? "并发布" : "，等待检查"}。` : `${formatDateId(date)} AI 日报已生成。`,
      actionUrl: post.id ? `/admin/posts/${post.id}/edit` : "/admin/ai-news",
      entityType: "aiNewsRun",
      entityId: runId,
      dedupeKey: `ai-news-run:${runId}:SUCCEEDED`,
      metadata: { runId, postId: post.id, postSlug: post.slug, published },
    });
  } catch (error) {
    console.error("Create AI news notification error:", error);
  }
}

export async function notifyDailyAiNewsFailure(date: Date, error: unknown) {
  const message = error instanceof Error ? error.message : "AI 日报生成失败";

  try {
    await createAdminNotification({
      type: NOTIFICATION_TYPES.aiNewsFailed,
      severity: NOTIFICATION_SEVERITIES.error,
      title: "AI 日报生成失败",
      body: message,
      actionUrl: "/admin/ai-news",
      entityType: "aiNewsRun",
      entityId: formatDateId(date),
      dedupeKey: `ai-news:${formatDateId(date)}:FAILED`,
      metadata: { date: formatDateId(date), error: message },
    });
  } catch (notificationError) {
    console.error("Create AI news failure notification error:", notificationError);
  }
}
