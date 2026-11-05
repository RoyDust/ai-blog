"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
    <div className="space-y-3 py-2" role="status" aria-live="polite">
      <p className="ed-eyebrow">账号</p>
      <p className="ed-empty__title">正在进入...</p>
      <span aria-hidden="true" className="ed-skel block h-[2px] w-24" />
    </div>
  );
}
