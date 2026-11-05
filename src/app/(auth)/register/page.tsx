'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { AuthDivider, AuthHeader, SubmitLabel } from '@/components/auth/AuthFormParts';
import { Input } from '@/components/ui';
import { fieldErrorMotionClassName } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { buildLoginPromptPath } from '@/lib/login-redirect';
import { apiMutate, toErrorMessage } from '@/lib/client-api';

const registerSchema = z
  .object({
    name: z.string().trim().min(1, '请输入昵称').max(50, '昵称最多 50 个字'),
    email: z.string().trim().email('请输入有效的邮箱地址'),
    password: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位'),
    confirmPassword: z.string(),
    terms: z.boolean().refine((value) => value, '请先同意服务条款与隐私政策'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

/**
 * 注册页（原型 12 第 4 张与状态画板 D）：纸面由 (auth) 布局提供，
 * 页头左对齐，结构同登录弹层；表单按简报第 12 节「全站表单写法」。
 */
export default function RegisterPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', terms: false },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await apiMutate('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
      });
      router.push(buildLoginPromptPath({ registered: true }));
    } catch (error) {
      toast.error(toErrorMessage(error, '注册失败，请稍后重试'));
    }
  };

  return (
    <>
      <AuthHeader eyebrow="账号" title="创建账号" description="注册一个账号，收藏文章并开始创作" />

      <form className="mt-5 flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)} aria-busy={isSubmitting}>
        <Input
          type="text"
          label="昵称"
          placeholder="输入你的昵称"
          autoComplete="nickname"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          type="email"
          label="邮箱"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          type="password"
          label="密码"
          placeholder="设置密码"
          autoComplete="new-password"
          helperText="至少 8 位"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          type="password"
          label="确认密码"
          placeholder="再次输入密码"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div>
          <div className="flex min-h-11 items-center gap-2.5">
            <input
              type="checkbox"
              id="terms"
              className={cn('ed-checkbox', errors.terms && 'border-[var(--danger-foreground)]')}
              aria-invalid={Boolean(errors.terms)}
              aria-describedby={errors.terms ? 'terms-error' : undefined}
              {...register('terms')}
            />
            <label htmlFor="terms" className="text-[0.875rem] leading-[1.6] text-[var(--text-body)]">
              我已阅读并同意
              <Link href="/terms" className="ed-link ed-link--inline">
                《服务条款》
              </Link>
              与
              <Link href="/privacy" className="ed-link ed-link--inline">
                《隐私政策》
              </Link>
            </label>
          </div>
          {errors.terms ? (
            <p id="terms-error" key={errors.terms.message} className={cn('ed-field-error mt-0 pl-[1.625rem]', fieldErrorMotionClassName)}>
              {errors.terms.message}
            </p>
          ) : null}
        </div>

        <div className="mt-1">
          <button type="submit" className="ed-btn ed-btn--block" disabled={isSubmitting}>
            <SubmitLabel busyLabel="正在创建..." idleLabel="创建账号" submitting={isSubmitting} />
          </button>
        </div>
      </form>

      <AuthDivider />

      <button type="button" className="ed-btn-outline ed-btn--block" onClick={() => signIn('github', { callbackUrl: '/' })}>
        使用 GitHub 注册
      </button>

      <p className="mt-5 text-[0.875rem] leading-[1.7] text-[var(--text-muted)]">
        已有账号？
        <Link href={buildLoginPromptPath()} className="ed-link ed-link--inline">
          去登录
        </Link>
      </p>
    </>
  );
}
