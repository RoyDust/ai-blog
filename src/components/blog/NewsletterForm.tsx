"use client";

import { type FormEvent, useState } from "react";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type SubmitState = "idle" | "submitting" | "success" | "error";

function getMessage(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  return fallback;
}

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.success === false) {
        setState("error");
        setMessage(getMessage(payload, "订阅失败，请稍后重试。"));
        return;
      }

      setState("success");
      setMessage("订阅请求已提交，请检查邮箱完成确认。");
    } catch {
      setState("error");
      setMessage("订阅失败，请稍后重试。");
    }
  };

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          aria-label="邮箱地址"
          autoComplete="email"
          disabled={state === "submitting"}
          leftSlot={<Mail className="h-4 w-4" />}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
        <Button className="h-10 whitespace-nowrap" disabled={state === "submitting"} type="submit">
          {state === "submitting" ? "提交中..." : "订阅"}
        </Button>
      </div>
      {message ? (
        <p
          className={`text-sm ${state === "error" ? "text-rose-500" : "text-[var(--muted)]"}`}
          role={state === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
