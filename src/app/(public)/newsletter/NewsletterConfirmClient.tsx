"use client";

import { useState, type FormEvent } from "react";

import { EmptyState, TextLink } from "@/components/editorial";
import { apiMutate, toErrorMessage } from "@/lib/client-api";

type ConfirmMode = "verify" | "unsubscribe";
type ConfirmState = "idle" | "submitting" | "succeeded" | "failed";

type NewsletterConfirmClientProps = {
  mode: ConfirmMode;
  token: string;
};

const copyByMode: Record<
  ConfirmMode,
  {
    endpoint: string;
    missingTitle: string;
    missingDescription: string;
    prompt: string;
    submitLabel: string;
    submittingLabel: string;
    cancelLabel: string;
    successMessage: string;
    errorFallback: string;
    doneLinkLabel: string;
    doneLinkHref: "/" | "/posts";
  }
> = {
  verify: {
    endpoint: "/api/newsletter/verify",
    missingTitle: "缺少订阅确认参数",
    missingDescription: "当前链接不包含有效的确认凭证，请从邮件中完整打开确认链接，或在首页重新提交订阅。",
    prompt: "为防止邮件安全网关预抓链接误激活订阅，访问本页不会自动写入订阅状态。请点击下方按钮完成确认（链接自发送起 48 小时内有效）。",
    submitLabel: "确认订阅",
    submittingLabel: "确认中…",
    cancelLabel: "返回首页",
    successMessage: "邮箱验证已完成，后续精选文章与日报摘要将按期发送。",
    errorFallback: "订阅确认失败，请检查链接是否过期后重试。",
    doneLinkLabel: "浏览最新文章",
    doneLinkHref: "/posts",
  },
  unsubscribe: {
    endpoint: "/api/newsletter/unsubscribe",
    missingTitle: "缺少退订确认参数",
    missingDescription: "当前链接不包含有效的退订凭证，请从邮件底部的「取消订阅」链接重新进入。",
    prompt: "确认退订后，你将不再收到后续精选文章与 AI 日报邮件。访问本页不会自动改动订阅状态，请点击下方按钮提交退订。",
    submitLabel: "确认退订",
    submittingLabel: "处理中…",
    cancelLabel: "暂不退订，返回首页",
    successMessage: "退订已完成，后续不会再向该邮箱发送精选邮件。",
    errorFallback: "退订请求处理失败，请稍后重试。",
    doneLinkLabel: "返回首页",
    doneLinkHref: "/",
  },
};

export function NewsletterConfirmClient({ mode, token }: NewsletterConfirmClientProps) {
  const copy = copyByMode[mode];
  const normalizedToken = token.trim();
  const [state, setState] = useState<ConfirmState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!normalizedToken) {
    return (
      <EmptyState
        actions={<TextLink href="/">返回首页</TextLink>}
        description={copy.missingDescription}
        role="alert"
        title={copy.missingTitle}
        tone="danger"
      />
    );
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || state === "succeeded") {
      return;
    }

    setState("submitting");
    setErrorMessage("");

    try {
      const payload = await apiMutate<{ data?: { verified?: boolean; unsubscribed?: boolean } }>(
        copy.endpoint,
        {
          method: "POST",
          body: JSON.stringify({ token: normalizedToken }),
        },
      );
      if (mode === "unsubscribe" && payload?.data?.unsubscribed === false) {
        throw new Error("退订链接无效或已失效");
      }
      if (mode === "verify" && payload?.data?.verified === false) {
        throw new Error("验证链接无效或已被使用");
      }
      setState("succeeded");
    } catch (error) {
      setState("failed");
      setErrorMessage(toErrorMessage(error, copy.errorFallback));
    }
  }

  if (state === "succeeded") {
    return (
      <div className="space-y-5 py-2">
        <p className="ed-banner ed-banner--success" role="status">
          {copy.successMessage}
        </p>
        <div>
          <TextLink href={copy.doneLinkHref}>{copy.doneLinkLabel}</TextLink>
        </div>
      </div>
    );
  }

  return (
    <form className="max-w-[42rem] space-y-5 py-2" onSubmit={handleConfirm}>
      <p className="text-[0.9375rem] leading-[1.75] text-[var(--text-body)]">{copy.prompt}</p>

      {state === "failed" && errorMessage ? (
        <p className="ed-banner ed-banner--danger" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
        <button className="ed-btn" disabled={state === "submitting"} type="submit">
          {state === "submitting" ? copy.submittingLabel : copy.submitLabel}
        </button>
        <TextLink href="/">{copy.cancelLabel}</TextLink>
      </div>
    </form>
  );
}
