'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button, Input, Card, CardContent } from '@/components/ui';
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
    <Card>
      <CardContent>
        <div className="mb-8 text-center">
          <h1 className="text-90 text-2xl font-bold">
            创建账号
          </h1>
          <p className="text-75 mt-2">
            注册一个账号，收藏文章并开始创作
          </p>
        </div>

        <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
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

          <div className="flex items-start">
            <input
              type="checkbox"
              id="terms"
              className="ui-checkbox mt-0.5 h-4 w-4 rounded"
              aria-invalid={Boolean(errors.terms)}
              {...register('terms')}
            />
            <label htmlFor="terms" className="text-75 ml-2 text-sm">
              我已阅读并同意{' '}
              <Link href="/terms" className="ui-link">
                《服务条款》
              </Link>{' '}
              与{' '}
              <Link href="/privacy" className="ui-link">
                《隐私政策》
              </Link>
            </label>
          </div>
          {errors.terms ? <p className="text-xs text-rose-500">{errors.terms.message}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '正在创建...' : '创建账号'}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--surface)] px-3 text-[var(--muted)]">或</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => signIn('github', { callbackUrl: '/' })}
        >
          使用 GitHub 注册
        </Button>

        <div className="mt-6 text-center">
          <p className="text-75 text-sm">
            已有账号？{' '}
            <Link
              href={buildLoginPromptPath()}
              className="ui-link font-medium"
            >
              去登录
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
