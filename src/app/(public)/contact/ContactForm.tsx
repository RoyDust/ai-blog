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
import { fieldErrorMotionClassName } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

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

/*
 * 方向 A 表单写法（简报第 12 节）：标签在上方 .8125rem 700，必填写 muted 灰「*」、可选写「（可选）」；
 * 输入框 44px、4px 圆角、1px --reader-border-strong 描边、透明底；字段错误时边框变 danger，
 * 下方一句 .8125rem danger 文案并淡入。手机端字号 16px，避免 iOS 聚焦放大。
 */
const fieldItemClassName = "gap-0";
const fieldLabelClassName = "ed-label block leading-[1.4] data-[error=true]:text-[var(--foreground)]";
const fieldInputClassName = "ed-input text-base sm:text-[0.9375rem]";
const fieldMessageClassName = cn("ed-field-error", fieldErrorMotionClassName);

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ed-label__required">
      *
    </span>
  );
}

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
      <form className="flex flex-col gap-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className={fieldItemClassName}>
                <FormLabel className={fieldLabelClassName}>
                  姓名
                  <span className="ed-label__optional">（可选）</span>
                </FormLabel>
                <FormControl>
                  <input
                    className={fieldInputClassName}
                    placeholder="你的名字"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={fieldMessageClassName} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className={fieldItemClassName}>
                <FormLabel className={fieldLabelClassName}>
                  邮箱
                  <RequiredMark />
                </FormLabel>
                <FormControl>
                  <input
                    className={fieldInputClassName}
                    aria-required="true"
                    placeholder="you@example.com"
                    type="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={fieldMessageClassName} />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem className={fieldItemClassName}>
              <FormLabel className={fieldLabelClassName}>
                主题
                <RequiredMark />
              </FormLabel>
              <FormControl>
                <input
                  className={fieldInputClassName}
                  aria-required="true"
                    placeholder="简短描述你的问题或想法"
                  {...field}
                />
              </FormControl>
              <FormMessage className={fieldMessageClassName} />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem className={fieldItemClassName}>
              <FormLabel className={fieldLabelClassName}>
                内容
                <RequiredMark />
              </FormLabel>
              <FormControl>
                <textarea
                  className="ed-textarea min-h-40 px-3 py-2.5 text-base leading-[1.7] sm:text-[0.9375rem]"
                  aria-required="true"
                  placeholder="详细描述..."
                  rows={6}
                  {...field}
                />
              </FormControl>
              <FormMessage className={fieldMessageClassName} />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-4">
          <button className="ed-btn" disabled={form.formState.isSubmitting} type="submit">
            发送邮件
          </button>
        </div>
      </form>
    </Form>
  );
}
