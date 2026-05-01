"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Globe2, Image as ImageIcon, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, ImageCropUploadDialog, Input, Textarea } from "@/components/admin/ui";

type SettingsUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
};

type BlogSettingsDraft = {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  locale: string;
};

interface AdminSettingsClientProps {
  user: SettingsUser;
  blogSettings: BlogSettingsDraft;
}

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }

  return fallback;
}

export function AdminSettingsClient({ user, blogSettings }: AdminSettingsClientProps) {
  const [profile, setProfile] = useState({
    name: user.name ?? "",
    email: user.email,
    image: user.image ?? "",
  });
  const [blogDraft, setBlogDraft] = useState(blogSettings);
  const [savingProfile, setSavingProfile] = useState(false);

  const initial = (profile.name || profile.email || "A").slice(0, 1).toUpperCase();

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          image: profile.image.trim() || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(getErrorMessage(data, "个人信息保存失败"));
        return;
      }

      setProfile({
        name: data.data.name ?? "",
        email: data.data.email,
        image: data.data.image ?? "",
      });
      toast.success("个人信息已保存");
    } catch {
      toast.error("个人信息保存失败，请稍后重试");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="设置"
        description="集中管理博客展示信息和管理员资料。博客配置先保持静态样式，个人信息已接入保存接口。"
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <WorkspacePanel title="个人信息" description="用于后台账号展示，也会影响作者署名的默认显示。">
          <form className="space-y-5" onSubmit={saveProfile}>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <ImageCropUploadDialog
                currentImage={profile.image}
                fallbackText={initial}
                outputFileName={`avatar-${user.id}.webp`}
                onUploaded={(url) => {
                  setProfile((value) => ({ ...value, image: url }));
                  toast.success("头像已裁切上传，保存个人信息后生效");
                }}
              />
              <div className="min-w-0">
                <p className="font-semibold text-[var(--foreground)]">{profile.name || "未命名管理员"}</p>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">{profile.email}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">点击头像裁切并上传新图片</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="显示名称"
                onChange={(event) => setProfile((value) => ({ ...value, name: event.target.value }))}
                placeholder="例如 RoyDust"
                value={profile.name}
              />
              <Input
                label="邮箱"
                onChange={(event) => setProfile((value) => ({ ...value, email: event.target.value }))}
                placeholder="admin@example.com"
                type="email"
                value={profile.email}
              />
            </div>

            <Input
              helperText="可手动填写远程图片 URL，也可以点击头像裁切上传。留空会移除头像。"
              label="头像 URL"
              onChange={(event) => setProfile((value) => ({ ...value, image: event.target.value }))}
              placeholder="https://example.com/avatar.png"
              value={profile.image}
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">角色：{user.role === "ADMIN" ? "管理员" : user.role}</p>
              <Button disabled={savingProfile} type="submit">
                {savingProfile ? "保存中..." : "保存个人信息"}
              </Button>
            </div>
          </form>
        </WorkspacePanel>

        <WorkspacePanel title="博客配置" description="当前后端还没有站点配置表，这里先按原型保留静态编辑样式。">
          <form className="space-y-4">
            <Input
              label="博客名称"
              onChange={(event) => setBlogDraft((value) => ({ ...value, siteName: event.target.value }))}
              value={blogDraft.siteName}
            />
            <Textarea
              label="站点描述"
              onChange={(event) => setBlogDraft((value) => ({ ...value, siteDescription: event.target.value }))}
              value={blogDraft.siteDescription}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="站点地址"
                onChange={(event) => setBlogDraft((value) => ({ ...value, siteUrl: event.target.value }))}
                value={blogDraft.siteUrl}
              />
              <Input
                label="默认语言"
                onChange={(event) => setBlogDraft((value) => ({ ...value, locale: event.target.value }))}
                value={blogDraft.locale}
              />
            </div>
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--muted)]">
              这些字段对应站点标题、SEO 描述和默认语言。接入持久化后会写入博客配置表并同步到 metadata。
            </div>
            <Button disabled type="button" variant="outline">
              保存博客配置（待接入）
            </Button>
          </form>
        </WorkspacePanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {[
          { icon: UserRound, title: "账号入口", text: "左下角头像菜单现在承载设置和退出账号。" },
          { icon: Globe2, title: "站点信息", text: "博客配置保持静态编辑态，等待后端配置表。" },
          { icon: ShieldCheck, title: "权限范围", text: "当前页面仅后台管理员可访问。" },
          { icon: ImageIcon, title: "头像展示", text: "个人头像 URL 保存后会进入用户资料。" },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" key={item.title}>
              <Icon className="h-5 w-5 text-[var(--brand)]" />
              <h3 className="mt-3 font-semibold text-[var(--foreground)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.text}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
