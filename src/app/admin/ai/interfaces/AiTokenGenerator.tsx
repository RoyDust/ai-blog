"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
  const reduceMotion = useReducedMotion();

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
    <div className="mt-5 border-t border-[var(--reader-border-strong)] pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-bold text-[var(--foreground)]">登录后生成 AI Token</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Token 明文只在生成后显示一次。离开页面后只能重新生成，旧 token 不会被反向展示。
          </p>
        </div>
        <Button type="button" onClick={generateToken} disabled={isGenerating}>
          {isGenerating ? "生成中…" : "生成 Token"}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="error"
            animate={{ opacity: 1 }}
            className="ed-banner ed-banner--danger mt-3 text-xs"
            exit={{ opacity: 0 }}
            initial={reduceMotion ? false : { opacity: 0 }}
            role="alert"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {token ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-3"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          transition={{ duration: 0.24 }}
        >
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">AI_TOKEN</p>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start">
              <code className="min-w-0 flex-1 rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] px-3 py-2 font-mono text-xs leading-5 break-all text-[var(--foreground)]">
                {token.token}
              </code>
              <Button size="sm" variant="outline" type="button" onClick={copyToken}>
                {isCopied ? "已复制" : "复制"}
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="font-bold text-[var(--text-muted)]">Token Prefix</dt>
              <dd className="mt-0.5 font-mono break-all text-[var(--foreground)]">{token.tokenPrefix}</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-bold text-[var(--text-muted)]">Scopes</dt>
              <dd className="mt-0.5 font-mono break-all text-[var(--foreground)]">{token.scopes.join(", ")}</dd>
            </div>
          </dl>
        </motion.div>
      ) : null}
    </div>
  );
}
