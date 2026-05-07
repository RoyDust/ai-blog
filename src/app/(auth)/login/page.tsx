'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react'
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { getPostLoginRedirect, getSafeLoginCallbackUrl } from '@/lib/login-redirect';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = getSafeLoginCallbackUrl(searchParams.get('callbackUrl'));
  const oauthCallbackUrl = '/auth/redirect';
  const authError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const errorMessages: Record<string, string> = {
    'not-admin': '当前不是管理员账号，请切换到拥有后台权限的账号。',
    OAuthAccountNotLinked: '该邮箱已注册，请先使用邮箱密码登录，然后在设置页绑定 GitHub。',
    GitHubEmailRequired: 'GitHub 未返回可用邮箱，请在 GitHub 账号中添加并验证邮箱后重试。',
    Configuration: 'GitHub 登录暂未正确配置，请联系管理员。',
  };
  const helperMessage = authError ? errorMessages[authError] ?? '登录失败，请稍后重试。' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      const session = await getSession();
      window.location.href = getPostLoginRedirect(session?.user?.role, callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="rounded-3xl border-[var(--border)] bg-[var(--surface)]">
      <CardContent className="p-0">
        <div className="border-b border-[var(--border)] bg-[var(--surface-alt)] px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">编辑工作台</p>
              <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--foreground)]">后台登录</h1>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-card)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            进入内容工作室，管理文章、评论与分类结构。
          </p>
        </div>

        <div className="px-6 py-6">
          {error && (
            <div className="ui-alert-danger mb-4 rounded-2xl px-4 py-3">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!error && helperMessage && (
            <div className="ui-alert-danger mb-4 rounded-2xl px-4 py-3">
              <p className="text-sm">{helperMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="邮箱"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              type="password"
              label="密码"
              placeholder="输入账号密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Button type="submit" className="w-full gap-2 py-2.5" disabled={isLoading}>
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {isLoading ? '正在验证...' : '进入后台'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>

          <div className="relative my-5">
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
            className="w-full gap-2 py-2.5"
            onClick={() => signIn('github', { callbackUrl: oauthCallbackUrl })}
          >
            使用 GitHub 登录
          </Button>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--muted)]">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" aria-hidden="true" />
            <p>
              没有账号？{' '}
              <Link href="/register" className="ui-link font-medium">
                创建账号
              </Link>
              ，再由管理员分配后台权限。
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Card className="rounded-3xl"><CardContent><div className="p-6 text-center text-sm text-75">正在加载...</div></CardContent></Card>}>
      <LoginForm />
    </Suspense>
  );
}
