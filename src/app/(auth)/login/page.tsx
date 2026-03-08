'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react'
import { Button, Input, Card, CardContent } from '@/components/ui';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const authError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const helperMessage = authError === 'not-admin' ? '当前不是管理员账号' : '';

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

      window.location.href = callbackUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="mb-8 text-center">
          <h1 className="text-90 text-2xl font-bold">
            Welcome Back
          </h1>
          <p className="text-75 mt-2">
            Sign in to your account
          </p>
        </div>

        {error && (
          <div className="ui-alert-danger mb-4 rounded-lg p-3">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!error && helperMessage && (
          <div className="ui-alert-danger mb-4 rounded-lg p-3">
            <p className="text-sm">{helperMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            type="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-75 text-sm">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="ui-link font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
