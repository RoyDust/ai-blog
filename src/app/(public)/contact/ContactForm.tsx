"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("请输入有效的邮箱地址"),
  subject: z.string().min(2, "主题至少 2 个字"),
  message: z.string().min(20, "内容至少 20 个字"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function buildContactMailto(to: string, data: ContactFormValues) {
  const body = [`姓名：${data.name?.trim() || "未填写"}`, `邮箱：${data.email}`, "", data.message].join("\n");

  return `mailto:${to}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(body)}`;
}

export function ContactForm() {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = (data: ContactFormValues) => {
    const to = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

    if (!to) {
      toast.error("联系邮箱暂未配置");
      return;
    }

    window.open(buildContactMailto(to, data), "_self");
    toast.success("已打开邮件客户端，请发送邮件。");
    reset();
  };

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="contact-name">
            姓名 <span className="text-[var(--text-faint)]">（可选）</span>
          </label>
          <input
            className="ui-ring w-full rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel-elevated)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            id="contact-name"
            placeholder="你的名字"
            {...register("name")}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="contact-email">
            邮箱 <span className="text-rose-500">*</span>
          </label>
          <input
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            aria-invalid={Boolean(errors.email)}
            className="ui-ring w-full rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel-elevated)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            id="contact-email"
            placeholder="you@example.com"
            type="email"
            {...register("email")}
          />
          {errors.email ? <p className="text-xs text-rose-500" id="contact-email-error">{errors.email.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="contact-subject">
          主题 <span className="text-rose-500">*</span>
        </label>
        <input
          aria-describedby={errors.subject ? "contact-subject-error" : undefined}
          aria-invalid={Boolean(errors.subject)}
          className="ui-ring w-full rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel-elevated)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          id="contact-subject"
          placeholder="简短描述你的问题或想法"
          {...register("subject")}
        />
        {errors.subject ? <p className="text-xs text-rose-500" id="contact-subject-error">{errors.subject.message}</p> : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="contact-message">
          内容 <span className="text-rose-500">*</span>
        </label>
        <textarea
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          aria-invalid={Boolean(errors.message)}
          className="ui-ring min-h-40 w-full resize-y rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel-elevated)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          id="contact-message"
          placeholder="详细描述..."
          rows={6}
          {...register("message")}
        />
        {errors.message ? <p className="text-xs text-rose-500" id="contact-message-error">{errors.message.message}</p> : null}
      </div>

      <button
        className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent-sky)] px-6 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        发送邮件
      </button>
    </form>
  );
}
