import { createAdminNotification, NOTIFICATION_SEVERITIES, NOTIFICATION_TYPES } from "@/lib/notifications";

function formatDateId(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getAiNewsPost(result: unknown) {
  const post = typeof result === "object" && result && "post" in result ? (result as { post?: unknown }).post : null;
  if (!post || typeof post !== "object") return null;

  const candidate = post as { id?: unknown; title?: unknown; slug?: unknown };
  return {
    id: typeof candidate.id === "string" ? candidate.id : null,
    title: typeof candidate.title === "string" ? candidate.title : null,
    slug: typeof candidate.slug === "string" ? candidate.slug : null,
  };
}

function getAiNewsRun(result: unknown) {
  const run = typeof result === "object" && result && "run" in result ? (result as { run?: unknown }).run : null;
  if (!run || typeof run !== "object") return null;

  const candidate = run as { id?: unknown; status?: unknown };
  return {
    id: typeof candidate.id === "string" ? candidate.id : null,
    status: typeof candidate.status === "string" ? candidate.status : null,
  };
}

export async function notifyDailyAiNewsSuccess(result: unknown, date: Date) {
  const run = getAiNewsRun(result);
  if (run?.status === "SKIPPED") {
    return;
  }

  const post = getAiNewsPost(result);
  const published = typeof result === "object" && result && "published" in result ? (result as { published?: unknown }).published === true : false;

  try {
    await createAdminNotification({
      type: NOTIFICATION_TYPES.aiNewsSucceeded,
      severity: NOTIFICATION_SEVERITIES.success,
      title: published ? "AI 日报已上线" : "AI 日报草稿已生成",
      body: post?.title ? `《${post.title}》已生成${published ? "并发布" : "，等待检查"}。` : `${formatDateId(date)} AI 日报已生成。`,
      actionUrl: post?.id ? `/admin/posts/${post.id}/edit` : "/admin/ai-news",
      entityType: "aiNewsRun",
      entityId: run?.id ?? formatDateId(date),
      dedupeKey: run?.id ? `ai-news-run:${run.id}:SUCCEEDED` : `ai-news:${formatDateId(date)}:SUCCEEDED`,
      metadata: { runId: run?.id ?? null, postId: post?.id ?? null, postSlug: post?.slug ?? null, published },
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
