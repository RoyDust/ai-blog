"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { TextAnchor } from "@/components/editorial";
import { apiMutate, toErrorMessage } from "@/lib/client-api";
import { cn } from "@/lib/cn";

type SubmitState = "idle" | "submitting" | "success" | "error";

const newsletterSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
});

type NewsletterFormValues = z.infer<typeof newsletterSchema>;

interface NewsletterFormProps {
  /** 首页「订阅」是唯一的主按钮；文章页用描边按钮（简报 16.1） */
  buttonVariant?: "primary" | "outline";
  /** 横带左侧的衬线文案 */
  pitch?: string;
  /** 是否显示「RSS 订阅 →」 */
  showRss?: boolean;
  className?: string;
}

/**
 * Newsletter 横带（简报 15.9 第 6 条）：上下各一条 1px 细线，无底色；
 * 左边衬线文案，右边邮箱输入框 + 订阅按钮 + 「RSS 订阅 →」。
 */
export function NewsletterForm({
  buttonVariant = "primary",
  pitch = "每周一封，精选文章与 AI 日报摘要。",
  showRss = true,
  className,
}: NewsletterFormProps) {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: NewsletterFormValues) => {
    setState("submitting");
    setMessage("");

    try {
      await apiMutate("/api/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: values.email }),
      });

      setState("success");
      setMessage("订阅请求已提交，请检查邮箱完成确认。");
    } catch (error) {
      setState("error");
      setMessage(toErrorMessage(error, "订阅失败，请稍后重试。"));
    }
  };

  const fieldError = errors.email?.message;

  return (
    <section aria-label="订阅 Newsletter" className={cn("border-y border-[var(--border)] py-5", className)}>
      <form
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <p className="ed-serif text-[1.0625rem] leading-[1.5] text-[var(--foreground)] lg:shrink-0">{pitch}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap">
          <div className="min-w-0 flex-1 sm:w-[11.25rem] sm:flex-none">
            <input
              aria-describedby={fieldError ? "newsletter-email-error" : undefined}
              aria-invalid={fieldError ? true : undefined}
              aria-label="邮箱地址"
              autoComplete="email"
              className="ed-input text-base sm:text-[0.9375rem]"
              disabled={isSubmitting}
              placeholder="你的邮箱"
              type="email"
              {...register("email")}
            />
          </div>
          <button className={buttonVariant === "primary" ? "ed-btn" : "ed-btn-outline"} disabled={isSubmitting} type="submit">
            {isSubmitting ? "提交中…" : "订阅"}
          </button>
          {showRss ? (
            <TextAnchor className="ml-1" href="/rss.xml">
              RSS 订阅
            </TextAnchor>
          ) : null}
        </div>
      </form>
      <AnimatePresence mode="wait">
        {fieldError || message ? (
          <motion.p
            key={fieldError ? "field-error" : state}
            id={fieldError ? "newsletter-email-error" : undefined}
            className={cn(
              "mt-3 text-[0.8125rem] lg:text-right",
              fieldError || state === "error" ? "text-[var(--danger-foreground)]" : "text-[var(--text-muted)]",
            )}
            role={fieldError || state === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {fieldError ?? message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
