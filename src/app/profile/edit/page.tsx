'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Input, Card, CardContent } from '@/components/ui'

export default function EditProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      setSuccess('资料更新成功')
      setTimeout(() => router.push('/profile'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_84%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-90 text-2xl font-bold">
            My Blog
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-75 transition-colors hover:text-[var(--brand-strong)]">
              首页
            </Link>
            <Link href="/profile" className="text-75 transition-colors hover:text-[var(--brand-strong)]">
              返回
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent>
            <h1 className="text-90 mb-6 text-2xl font-bold">编辑资料</h1>

            {error && (
              <div className="ui-alert-danger mb-4 rounded-lg p-3">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="ui-status-success mb-4 rounded-lg p-3">
                <p className="text-sm">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="用户名"
                placeholder="请输入用户名"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />

              <Input
                label="邮箱"
                type="email"
                placeholder="请输入邮箱"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />

              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '保存中...' : '保存'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
