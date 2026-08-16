"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/ui/form";

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

const readerInputClassName =
  "ui-ring w-full rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel-elevated)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const readerLabelClassName = "text-sm font-medium text-[var(--foreground)]";
const readerMessageClassName = "text-xs text-rose-500";

export function ContactForm() {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  const onSubmit = (data: ContactFormValues) => {
    const to = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

    if (!to) {
      toast.error("联系邮箱暂未配置");
      return;
    }

    window.open(buildContactMailto(to, data), "_self");
    toast.success("已打开邮件客户端，请发送邮件。");
    form.reset();
  };

  return (
    <Form {...form}>
      <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <FormLabel className={readerLabelClassName}>
                  姓名 <span className="text-[var(--text-faint)]">（可选）</span>
                </FormLabel>
                <FormControl>
                  <input
                    className={readerInputClassName}
                    placeholder="你的名字"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={readerMessageClassName} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <FormLabel className={readerLabelClassName}>
                  邮箱 <span className="text-rose-500">*</span>
                </FormLabel>
                <FormControl>
                  <input
                    className={readerInputClassName}
                    placeholder="you@example.com"
                    type="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={readerMessageClassName} />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className={readerLabelClassName}>
                主题 <span className="text-rose-500">*</span>
              </FormLabel>
              <FormControl>
                <input
                  className={readerInputClassName}
                  placeholder="简短描述你的问题或想法"
                  {...field}
                />
              </FormControl>
              <FormMessage className={readerMessageClassName} />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className={readerLabelClassName}>
                内容 <span className="text-rose-500">*</span>
              </FormLabel>
              <FormControl>
                <textarea
                  className="ui-ring min-h-40 w-full resize-y rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel-elevated)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  placeholder="详细描述..."
                  rows={6}
                  {...field}
                />
              </FormControl>
              <FormMessage className={readerMessageClassName} />
            </FormItem>
          )}
        />

        <button
          className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent-sky)] px-6 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          发送邮件
        </button>
      </form>
    </Form>
  );
}
