import { getServerSession } from "next-auth";
import { VisitTracker } from "@/components/analytics/VisitTracker";
import { AppShell } from "@/components/layout/AppShell";
import { authOptions } from "@/lib/auth";
import { getBlogSettings } from "@/lib/blog-settings";
import { getPublicProfile } from "@/lib/public-profile";
import { getUserReadingStats } from "@/lib/reading-stats";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [profile, blogSettings, session] = await Promise.all([
    getPublicProfile(),
    getBlogSettings(),
    getServerSession(authOptions),
  ]);
  const readingStats = session?.user?.id
    ? await getUserReadingStats(session.user.id, blogSettings.reading.monthlyGoal)
    : null;

  return (
    <AppShell
      profile={profile}
      readingStats={readingStats}
      siteDescription={blogSettings.siteDescription}
      siteName={blogSettings.siteName}
    >
      <VisitTracker />
      {children}
    </AppShell>
  );
}
