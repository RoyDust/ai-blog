"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent } from "@/components/ui";
import { getSafeLoginCallbackUrl } from "@/lib/login-redirect";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const callbackUrl = getSafeLoginCallbackUrl(searchParams.get("callbackUrl"));

  return (
    <LoginForm
      mode="page"
      callbackUrl={callbackUrl}
      oauthCallbackUrl="/auth/redirect"
      authError={searchParams.get("error")}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="rounded-3xl">
          <CardContent>
            <div className="p-6 text-center text-sm text-75">正在加载...</div>
          </CardContent>
        </Card>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
