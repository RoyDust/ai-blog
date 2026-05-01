import { AppShell } from "@/components/layout/AppShell";
import { getPublicProfile } from "@/lib/public-profile";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const profile = await getPublicProfile();

  return <AppShell profile={profile}>{children}</AppShell>;
}
