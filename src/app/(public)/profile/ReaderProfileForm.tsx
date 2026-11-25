"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/coss/ui/form";
import { fieldErrorMotionClassName } from "@/components/ui/Input";
import { apiMutate, toErrorMessage } from "@/lib/client-api";
import { cn } from "@/lib/cn";

export type ReaderProfileUser = {
  id: string;
  name: string;
  email: string;
  image: string;
  role: string;
  joinedDate?: string | null;
};

function isAllowedAvatarUrl(value: string) {
  if (!value) {
    return true;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function createReaderProfileSchema(currentEmail = "") {
  const normalizedCurrentEmail = currentEmail.trim().toLowerCase();

  return z
    .object({
      name: z.string().trim().min(1, "请输入显示名称").max(80, "显示名称最多 80 个字"),
      email: z.string().trim().email("请输入有效的邮箱地址"),
      image: z
        .string()
        .trim()
        .max(2048, "头像链接最多 2048 个字符")
        .refine(isAllowedAvatarUrl, {
          message: "请输入以 http:// 或 https:// 开头的有效图片链接",
        }),
      currentPassword: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      const normalizedNextEmail = values.email.trim().toLowerCase();
      if (
        normalizedCurrentEmail &&
        normalizedNextEmail !== normalizedCurrentEmail &&
        (values.currentPassword ?? "").trim().length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currentPassword"],
          message: "修改登录邮箱需验证当前登录密码",
        });
      }
    });
}

export const readerProfileSchema = createReaderProfileSchema();

export type ReaderProfileFormValues = z.infer<typeof readerProfileSchema>;

const PROFILE_API_ERROR_MESSAGES: Record<string, string> = {
  "Email already in use": "该邮箱已被其他账号使用",
  "Invalid email": "请输入有效的邮箱地址",
  "Invalid name": "请输入有效的显示名称",
  "Invalid image": "请输入有效的头像链接",
  "Invalid currentPassword": "请输入有效的当前登录密码",
  "name is too long": "显示名称最多 80 个字",
  "image is too long": "头像链接最多 2048 个字符",
};

function toProfileErrorMessage(error: unknown) {
  const message = toErrorMessage(error, "个人资料保存失败，请稍后重试");
  return PROFILE_API_ERROR_MESSAGES[message] ?? message;
}

function getInitial(value: string) {
  const firstCharacter = Array.from(value.trim())[0];
  return firstCharacter ? firstCharacter.toLocaleUpperCase("zh-CN") : "U";
}

const fieldItemClassName = "content-start gap-1.5";
const fieldLabelClassName = "block text-xs font-semibold text-[var(--foreground)]";
const fieldInputClassName =
  "ui-ring h-10 w-full rounded-xl border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,var(--card-bg)_48%)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const fieldMessageClassName = cn("text-xs text-[var(--danger-foreground)]", fieldErrorMotionClassName);

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-[var(--danger-foreground)]">
      *
    </span>
  );
}

export function ReaderProfileForm({ user }: { user: ReaderProfileUser }) {
  const router = useRouter();
  const session = useSession();
  const [savedUser, setSavedUser] = useState<ReaderProfileUser>(user);
  const schema = useMemo(() => createReaderProfileSchema(savedUser.email), [savedUser.email]);

  const form = useForm<ReaderProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name,
      email: user.email,
      image: user.image,
      currentPassword: "",
    },
  });

  const watchedEmail = useWatch({ control: form.control, name: "email" });
  const normalizedDraftEmail = (watchedEmail ?? "").trim().toLowerCase();
  const normalizedSavedEmail = savedUser.email.trim().toLowerCase();
  const isEmailChanged =
    normalizedDraftEmail.length > 0 && normalizedDraftEmail !== normalizedSavedEmail;

  const displayName = savedUser.name || savedUser.email || "已登录账号";
  const roleLabel = savedUser.role === "ADMIN" ? "管理员（ADMIN）" : "读者账号（USER）";

  const onSubmit = async (values: ReaderProfileFormValues) => {
    const normalizedImage = values.image.trim();
    const normalizedEmail = values.email.trim().toLowerCase();
    const changingEmail = normalizedEmail !== normalizedSavedEmail;

    try {
      const response = await apiMutate<{
        success?: boolean;
        data?: {
          id: string;
          name: string | null;
          email: string;
          image: string | null;
        };
      }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name.trim(),
          email: normalizedEmail,
          image: normalizedImage || null,
          ...(changingEmail ? { currentPassword: values.currentPassword ?? "" } : {}),
        }),
      });

      const nextName = response.data?.name ?? values.name.trim();
      const nextEmail = response.data?.email ?? normalizedEmail;
      const nextImage = response.data?.image ?? (normalizedImage || "");

      setSavedUser((prev) => ({
        ...prev,
        name: nextName,
        email: nextEmail,
        image: nextImage ?? "",
      }));

      form.reset({
        name: nextName,
        email: nextEmail,
        image: nextImage ?? "",
        currentPassword: "",
      });

      if (typeof session?.update === "function") {
        await session.update({
          name: nextName,
          email: nextEmail,
          image: nextImage || null,
        });
      }

      router.refresh?.();
      toast.success("个人资料已保存");
    } catch (error) {
      toast.error(toProfileErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <section
        aria-label="当前账号信息"
        className="flex flex-col gap-4 border-b border-dashed border-[var(--line-color)] pb-5 sm:flex-row sm:items-center"
      >
        {savedUser.image ? (
          <span
            aria-hidden="true"
            className="h-16 w-16 shrink-0 rounded-2xl border border-[var(--reader-border)] bg-[var(--surface-alt)] bg-cover bg-center"
            style={{ backgroundImage: `url("${encodeURI(savedUser.image)}")` }}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--btn-regular-bg)] font-display text-xl font-bold text-[var(--btn-content)]"
          >
            {getInitial(displayName)}
          </span>
        )}

        <div className="min-w-0 space-y-1">
          <p className="truncate font-display text-lg font-bold text-[var(--foreground)]">{displayName}</p>
          <p className="truncate font-mono text-xs text-[var(--text-muted)]">{savedUser.email}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
            <span>账号身份：{roleLabel}</span>
            {savedUser.joinedDate ? <span>注册日期：{savedUser.joinedDate}</span> : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="reader-profile-form-heading" className="space-y-4">
        <h2 id="reader-profile-form-heading" className="reader-section-heading text-base sm:text-lg">
          基本资料
        </h2>

        <Form {...form}>
          <form
            aria-busy={form.formState.isSubmitting}
            className="flex max-w-[40rem] flex-col gap-4"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className={fieldItemClassName}>
                    <FormLabel className={fieldLabelClassName}>
                      显示名称
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <input
                        aria-required="true"
                        autoComplete="nickname"
                        className={fieldInputClassName}
                        placeholder="输入你的显示名称"
                        type="text"
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
                        aria-required="true"
                        autoComplete="email"
                        className={fieldInputClassName}
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

            {isEmailChanged ? (
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field, fieldState }) => (
                  <FormItem className={fieldItemClassName}>
                    <FormLabel className={fieldLabelClassName}>
                      当前登录密码
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <input
                        aria-required="true"
                        autoComplete="current-password"
                        className={fieldInputClassName}
                        placeholder="输入当前登录密码以确认更换邮箱"
                        type="password"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    {fieldState.error ? (
                      <FormMessage className={fieldMessageClassName} />
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">更换登录邮箱前需验证当前账号密码。</p>
                    )}
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="image"
              render={({ field, fieldState }) => (
                <FormItem className={fieldItemClassName}>
                  <FormLabel className={fieldLabelClassName}>
                    头像链接
                    <span className="ml-1 font-normal text-[var(--text-muted)]">（可选）</span>
                  </FormLabel>
                  <FormControl>
                    <input
                      autoComplete="url"
                      className={fieldInputClassName}
                      placeholder="https://example.com/avatar.png"
                      type="url"
                      {...field}
                    />
                  </FormControl>
                  {fieldState.error ? (
                    <FormMessage className={fieldMessageClassName} />
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">支持 http:// 或 https:// 图片地址，留空则使用首字母头像。</p>
                  )}
                </FormItem>
              )}
            />

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
              <button
                className="home-primary-cta inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                disabled={form.formState.isSubmitting}
                type="submit"
              >
                {form.formState.isSubmitting ? "正在保存..." : "保存资料"}
              </button>
              <Link className="ui-link text-sm font-medium" href="/bookmarks">
                查看我的收藏
              </Link>
            </div>
          </form>
        </Form>
      </section>
    </div>
  );
}
