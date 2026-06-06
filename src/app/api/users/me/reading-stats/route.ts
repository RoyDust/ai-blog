import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { getBlogSettings } from "@/lib/blog-settings";
import { getUserReadingStats } from "@/lib/reading-stats";

async function GETHandler() {
  try {
    const session = await requireSession();
    const settings = await getBlogSettings();
    const stats = await getUserReadingStats(session.user.id, settings.reading.monthlyGoal);

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.users.me.readingStats.read",
  route: "/api/users/me/reading-stats",
});
