"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/admin/ui";

type GeneratedAiToken = {
  token: string;
  tokenPrefix: string;
  clientId: string;
  name: string;
  scopes: string[];
  createdAt: string;
};

type ApiResponse =
  | {
      success: true;
      data: GeneratedAiToken;
    }
  | {
      error: string;
    };

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(value);
  }
}

export function AiTokenGenerator() {
  const [token, setToken] = useState<GeneratedAiToken | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState("");

  async function generateToken() {
    setIsGenerating(true);
    setIsCopied(false);
    setError("");

    try {
      const response = await fetch("/api/admin/ai/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !("success" in payload)) {
        throw new Error("error" in payload ? payload.error : "AI Token 生成失败");
      }

      setToken(payload.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "AI Token 生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyToken() {
    if (!token) return;

    await copyText(token.token);
    setIsCopied(true);
  }

  return (
    <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <KeyRound className="h-4 w-4 text-emerald-600" />
            登录后生成 AI Token
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Token 明文只在生成后显示一次。离开页面后只能重新生成，旧 token 不会被反向展示。
          </p>
        </div>
        <Button size="sm" type="button" onClick={generateToken} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          生成 Token
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      {token ? (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">AI_TOKEN</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-xs leading-5 text-[var(--foreground)]">
                {token.token}
              </code>
              <Button size="sm" variant="outline" type="button" onClick={copyToken}>
                {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {isCopied ? "已复制" : "复制"}
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
            <div className="rounded-lg bg-[var(--surface-alt)] px-3 py-2">
              <dt className="font-semibold text-[var(--foreground)]">Token Prefix</dt>
              <dd className="mt-1 break-all">{token.tokenPrefix}</dd>
            </div>
            <div className="rounded-lg bg-[var(--surface-alt)] px-3 py-2">
              <dt className="font-semibold text-[var(--foreground)]">Scopes</dt>
              <dd className="mt-1 break-all">{token.scopes.join(", ")}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
