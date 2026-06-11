import { VisitTracker } from "@/components/analytics/VisitTracker";
import { AppShell } from "@/components/layout/AppShell";
import { getBlogSettings } from "@/lib/blog-settings";
import { getPublicProfile } from "@/lib/public-profile";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [profile, blogSettings] = await Promise.all([
    getPublicProfile(),
    getBlogSettings(),
  ]);

  return (
    <div className="serif-display-scope">
      <AppShell
        profile={profile}
        siteDescription={blogSettings.siteDescription}
        siteName={blogSettings.siteName}
      >
        <VisitTracker />
        {children}
      </AppShell>
    </div>
  );
}
