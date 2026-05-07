"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui";
import { getPostLoginRedirect } from "@/lib/login-redirect";

export default function AuthRedirectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    router.replace(getPostLoginRedirect(session?.user?.role, "/admin"));
  }, [router, session?.user?.role, status]);

  return (
    <Card className="rounded-3xl border-[var(--border)] bg-[var(--surface)]">
      <CardContent>
        <div className="p-6 text-center text-sm text-75">正在进入...</div>
      </CardContent>
    </Card>
  );
}
