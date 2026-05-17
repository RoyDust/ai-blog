"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { FileText, Globe2, HardDrive, ImageIcon, Mail, ShieldCheck, Target, UserRound } from "lucide-react";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, ImageCropUploadDialog, Input, Textarea } from "@/components/admin/ui";
import { GitHubBinding } from "@/components/admin/settings/GitHubBinding";
import { getApiErrorMessage } from "@/lib/admin-api-client";

type SettingsUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  githubLinked: boolean;
};

type BlogSettingsDraft = {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  locale: string;
  appearance: {
    backgroundImageUrl: string;
  };
  profile: {
    subtitle: string;
    tagline: string;
    bio: string;
    intro: string;
    githubUrl: string;
    twitterUrl: string;
  };
  about: {
    aboutTitle: string;
    aboutParagraphs: string[];
    nowTitle: string;
    nowItems: string[];
    highlights: Array<{ title: string; description: string }>;
    stackTitle: string;
    stack: Array<{ title: string; description: string }>;
    contactTitle: string;
    contactDescription: string;
  };
  reading: {
    monthlyGoal: number;
  };
  newsletter: {
    enabled: boolean;
    provider: "none" | "log";
    fromEmail: string;
    replyTo: string;
  };
};

type OperationLogSettings = {
  maxStorageBytes: number;
  maxStorageMb: number;
  currentStorageBytes: number;
  currentStorageLabel: string;
  rowCount: number;
};

interface AdminSettingsClientProps {
  user: SettingsUser;
  blogSettings: BlogSettingsDraft;
  operationLogSettings: OperationLogSettings;
}

type SettingsTabId = "account" | "site" | "publicProfile" | "reading" | "newsletter" | "about" | "logs";

const settingsTabs = [
  { id: "account", label: "账号资料", description: "登录身份", icon: UserRound },
  { id: "site", label: "站点基础", description: "头部与页脚", icon: Globe2 },
  { id: "publicProfile", label: "公开个人信息栏", description: "侧栏资料", icon: ShieldCheck },
  { id: "reading", label: "阅读目标", description: "前台统计", icon: Target },
  { id: "newsletter", label: "邮件订阅", description: "订阅基础", icon: Mail },
  { id: "about", label: "关于页面", description: "页面文案", icon: FileText },
  { id: "logs", label: "日志策略", description: "后台运维", icon: HardDrive },
] satisfies Array<{ id: SettingsTabId; label: string; description: string; icon: typeof UserRound }>;

function toMultiline(items: string[]) {
  return items.join("\n");
}

function fromMultiline(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCssImageUrl(value: string) {
  const url = value.trim() || "/images/fuwari-night-city-bg.svg";
  return `url("${url.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "").replaceAll("\r", "")}")`;
}

export function AdminSettingsClient({ user, blogSettings, operationLogSettings }: AdminSettingsClientProps) {
  const [profile, setProfile] = useState({
    name: user.name ?? "",
    email: user.email,
    image: user.image ?? "",
  });
  const [blogDraft, setBlogDraft] = useState(blogSettings);
  const [logSettings, setLogSettings] = useState(operationLogSettings);
  const [logDraft, setLogDraft] = useState({ maxStorageMb: String(operationLogSettings.maxStorageMb) });
  const [activeTab, setActiveTab] = useState<SettingsTabId>("account");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBlogSettings, setSavingBlogSettings] = useState(false);
  const [savingLogSettings, setSavingLogSettings] = useState(false);

  const initial = (profile.name || profile.email || "A").slice(0, 1).toUpperCase();
  const usagePercent =
    logSettings.maxStorageBytes > 0
      ? Math.min(Math.round((logSettings.currentStorageBytes / logSettings.maxStorageBytes) * 100), 100)
      : 0;

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
        toast.error(getApiErrorMessage(data, "个人信息保存失败"));
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

  const saveLogSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const maxStorageMb = Number(logDraft.maxStorageMb);

    if (!Number.isFinite(maxStorageMb) || maxStorageMb < 1 || maxStorageMb > 512) {
      toast.error("日志大小限制必须在 1 到 512 MB 之间");
      return;
    }

    setSavingLogSettings(true);

    try {
      const response = await fetch("/api/admin/settings/operation-logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxStorageMb }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        toast.error(getApiErrorMessage(data, "日志设置保存失败"));
        return;
      }

      setLogSettings(data.data);
      setLogDraft({ maxStorageMb: String(data.data.maxStorageMb) });
      toast.success(data.data.deletedCount > 0 ? `日志设置已保存，已清理 ${data.data.deletedCount} 条旧日志` : "日志设置已保存");
    } catch {
      toast.error("日志设置保存失败，请稍后重试");
    } finally {
      setSavingLogSettings(false);
    }
  };

  const saveBlogSettings = async (event: FormEvent<HTMLFormElement>, payload: Partial<BlogSettingsDraft>) => {
    event.preventDefault();
    setSavingBlogSettings(true);

    try {
      const response = await fetch("/api/admin/settings/blog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        toast.error(getApiErrorMessage(data, "博客配置保存失败"));
        return;
      }

      setBlogDraft(data.data);
      toast.success("博客配置已保存");
    } catch {
      toast.error("博客配置保存失败，请稍后重试");
    } finally {
      setSavingBlogSettings(false);
    }
  };

  const updatePublicProfileDraft = (nextProfile: Partial<BlogSettingsDraft["profile"]>) => {
    setBlogDraft((value) => ({
      ...value,
      profile: { ...value.profile, ...nextProfile },
    }));
  };

  const saveSiteSettings = (event: FormEvent<HTMLFormElement>) =>
    saveBlogSettings(event, {
      siteName: blogDraft.siteName,
      siteDescription: blogDraft.siteDescription,
      siteUrl: blogDraft.siteUrl,
      locale: blogDraft.locale,
      appearance: blogDraft.appearance,
    });

  const savePublicProfileSettings = (event: FormEvent<HTMLFormElement>) =>
    saveBlogSettings(event, { profile: blogDraft.profile });

  const saveReadingSettings = (event: FormEvent<HTMLFormElement>) =>
    saveBlogSettings(event, { reading: blogDraft.reading });

  const saveNewsletterSettings = (event: FormEvent<HTMLFormElement>) =>
    saveBlogSettings(event, { newsletter: blogDraft.newsletter });

  const updateNewsletterDraft = (nextNewsletter: Partial<BlogSettingsDraft["newsletter"]>) => {
    setBlogDraft((value) => ({
      ...value,
      newsletter: { ...value.newsletter, ...nextNewsletter },
    }));
  };

  const saveAboutSettings = (event: FormEvent<HTMLFormElement>) =>
    saveBlogSettings(event, { about: blogDraft.about });

  const updateAboutDraft = (nextAbout: Partial<BlogSettingsDraft["about"]>) => {
    setBlogDraft((value) => ({
      ...value,
      about: { ...value.about, ...nextAbout },
    }));
  };

  const updateAboutCard = (
    group: "highlights" | "stack",
    index: number,
    field: "title" | "description",
    nextValue: string,
  ) => {
    setBlogDraft((value) => ({
      ...value,
      about: {
        ...value.about,
        [group]: value.about[group].map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: nextValue } : item)),
      },
    }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="设置"
        description="集中管理管理员资料、博客展示信息和后台运行策略。"
      />

      <div className="space-y-5">
        <div className="overflow-x-auto pb-1">
          <div
            aria-label="设置分类"
            className="inline-flex min-w-full gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
            role="tablist"
          >
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  aria-controls="settings-panel"
                  aria-selected={isActive}
                  className={`flex min-w-[150px] flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                    isActive
                      ? "bg-[var(--surface-alt)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                  }`}
                  id={`settings-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{tab.label}</span>
                    <span className="mt-0.5 block truncate text-xs opacity-75">{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          aria-labelledby={`settings-tab-${activeTab}`}
          id="settings-panel"
          role="tabpanel"
        >
          {activeTab === "account" ? (
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

                <GitHubBinding initialLinked={user.githubLinked} />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--muted)]">角色：{user.role === "ADMIN" ? "管理员" : user.role}</p>
                  <Button disabled={savingProfile} type="submit">
                    {savingProfile ? "保存中..." : "保存个人信息"}
                  </Button>
                </div>
              </form>
            </WorkspacePanel>
          ) : null}

          {activeTab === "site" ? (
          <form className="space-y-5" onSubmit={saveSiteSettings}>
            <WorkspacePanel title="博客配置" description="同步控制前台头部品牌、底部说明、SEO 信息和机器可读入口。">
              <div className="space-y-4">
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
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <Input
                    helperText="支持站内路径或 http(s) 图片 URL；留空会恢复默认夜景背景。"
                    label="前台背景图 URL"
                    onChange={(event) =>
                      setBlogDraft((value) => ({
                        ...value,
                        appearance: {
                          ...value.appearance,
                          backgroundImageUrl: event.target.value,
                        },
                      }))
                    }
                    placeholder="/images/fuwari-night-city-bg.svg"
                    value={blogDraft.appearance.backgroundImageUrl}
                  />
                  <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]">
                    <div
                      aria-hidden="true"
                      className="h-28 bg-cover bg-center"
                      style={{ backgroundImage: toCssImageUrl(blogDraft.appearance.backgroundImageUrl) }}
                    />
                    <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
                      <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>前台顶部背景预览</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--muted)]">
                  这些字段会同步到前台导航左侧品牌、页脚说明、站点标题、SEO 描述、RSS、站点地图、默认语言和前台顶部背景。
                </div>
                <div className="flex justify-end">
                  <Button disabled={savingBlogSettings} type="submit" variant="outline">
                    {savingBlogSettings ? "保存中..." : "保存博客配置"}
                  </Button>
                </div>
              </div>
            </WorkspacePanel>
          </form>
          ) : null}

          {activeTab === "publicProfile" ? (
          <form className="space-y-5" onSubmit={savePublicProfileSettings}>
            <WorkspacePanel title="公开个人信息栏" description="同步控制前台左侧作者资料卡和关于页头部介绍。">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="作者副标题"
                    onChange={(event) => updatePublicProfileDraft({ subtitle: event.target.value })}
                    value={blogDraft.profile.subtitle}
                  />
                  <Input
                    label="作者标语"
                    onChange={(event) => updatePublicProfileDraft({ tagline: event.target.value })}
                    value={blogDraft.profile.tagline}
                  />
                </div>
                <Textarea
                  label="作者简介"
                  onChange={(event) => updatePublicProfileDraft({ bio: event.target.value })}
                  value={blogDraft.profile.bio}
                />
                <Textarea
                  label="作者介绍"
                  onChange={(event) => updatePublicProfileDraft({ intro: event.target.value })}
                  value={blogDraft.profile.intro}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="GitHub 链接"
                    onChange={(event) => updatePublicProfileDraft({ githubUrl: event.target.value })}
                    value={blogDraft.profile.githubUrl}
                  />
                  <Input
                    label="Twitter / X 链接"
                    onChange={(event) => updatePublicProfileDraft({ twitterUrl: event.target.value })}
                    value={blogDraft.profile.twitterUrl}
                  />
                </div>
                <div className="flex justify-end">
                  <Button disabled={savingBlogSettings} type="submit" variant="outline">
                    {savingBlogSettings ? "保存中..." : "保存博客配置"}
                  </Button>
                </div>
              </div>
            </WorkspacePanel>
          </form>
          ) : null}

          {activeTab === "reading" ? (
          <form className="space-y-5" onSubmit={saveReadingSettings}>
            <WorkspacePanel title="阅读目标" description="前台登录用户侧栏会使用真实阅读记录，并按这里配置的目标计算本月进度。">
              <div className="space-y-4">
                <Input
                  helperText="只影响目标值；已读篇数、阅读时长和连续阅读天数来自真实访问记录。"
                  label="每月目标篇数"
                  min={1}
                  max={999}
                  onChange={(event) =>
                    setBlogDraft((value) => ({
                      ...value,
                      reading: {
                        ...value.reading,
                        monthlyGoal: Number(event.target.value) || 1,
                      },
                    }))
                  }
                  rightSlot={<span className="px-2 text-sm font-medium text-[var(--muted)]">篇</span>}
                  step="1"
                  type="number"
                  value={blogDraft.reading.monthlyGoal}
                />
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--muted)]">
                  未登录访客不会看到前台阅读统计和本月阅读目标。
                </div>
                <div className="flex justify-end">
                  <Button disabled={savingBlogSettings} type="submit" variant="outline">
                    {savingBlogSettings ? "保存中..." : "保存阅读目标"}
                  </Button>
                </div>
              </div>
            </WorkspacePanel>
          </form>
          ) : null}

          {activeTab === "newsletter" ? (
          <form className="space-y-5" onSubmit={saveNewsletterSettings}>
            <WorkspacePanel title="邮件订阅" description="控制前台 Newsletter 订阅基础开关和本地日志发送器。">
              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                  <input
                    checked={blogDraft.newsletter.enabled}
                    className="h-4 w-4"
                    onChange={(event) => updateNewsletterDraft({ enabled: event.target.checked })}
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--foreground)]">启用订阅入口</span>
                    <span className="mt-1 block text-sm text-[var(--muted)]">首页和文章页会读取此开关展示订阅入口。</span>
                  </span>
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    helperText="当前只支持 none 和 log；真实邮件供应商会在后续批次接入。"
                    label="发送器"
                    onChange={(event) => updateNewsletterDraft({ provider: event.target.value === "log" ? "log" : "none" })}
                    value={blogDraft.newsletter.provider}
                  />
                  <Input
                    label="发件邮箱"
                    onChange={(event) => updateNewsletterDraft({ fromEmail: event.target.value })}
                    placeholder="news@example.com"
                    type="email"
                    value={blogDraft.newsletter.fromEmail}
                  />
                </div>
                <Input
                  label="回复邮箱"
                  onChange={(event) => updateNewsletterDraft({ replyTo: event.target.value })}
                  placeholder="reply@example.com"
                  type="email"
                  value={blogDraft.newsletter.replyTo}
                />
                <div className="flex justify-end">
                  <Button disabled={savingBlogSettings} type="submit" variant="outline">
                    {savingBlogSettings ? "保存中..." : "保存订阅设置"}
                  </Button>
                </div>
              </div>
            </WorkspacePanel>
          </form>
          ) : null}

          {activeTab === "about" ? (
          <form className="space-y-5" onSubmit={saveAboutSettings}>
            <WorkspacePanel title="关于页面内容" description="同步控制 /about 页面中的介绍、动态、亮点、技术栈和联系文案。">
              <div className="space-y-5">
                <Input
                  label="关于模块标题"
                  onChange={(event) => updateAboutDraft({ aboutTitle: event.target.value })}
                  value={blogDraft.about.aboutTitle}
                />
                <Textarea
                  helperText="每行一段，最多保存 4 段。"
                  label="关于模块段落"
                  onChange={(event) => updateAboutDraft({ aboutParagraphs: fromMultiline(event.target.value) })}
                  value={toMultiline(blogDraft.about.aboutParagraphs)}
                />
                <Input
                  label="动态模块标题"
                  onChange={(event) => updateAboutDraft({ nowTitle: event.target.value })}
                  value={blogDraft.about.nowTitle}
                />
                <Textarea
                  helperText="每行一条，最多保存 6 条。"
                  label="动态条目"
                  onChange={(event) => updateAboutDraft({ nowItems: fromMultiline(event.target.value) })}
                  value={toMultiline(blogDraft.about.nowItems)}
                />
                <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">亮点卡片</p>
                  {blogDraft.about.highlights.map((item, index) => (
                    <div className="grid gap-3 md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]" key={`highlight-${index}`}>
                      <Input
                        label={`亮点 ${index + 1} 标题`}
                        onChange={(event) => updateAboutCard("highlights", index, "title", event.target.value)}
                        value={item.title}
                      />
                      <Input
                        label={`亮点 ${index + 1} 描述`}
                        onChange={(event) => updateAboutCard("highlights", index, "description", event.target.value)}
                        value={item.description}
                      />
                    </div>
                  ))}
                </div>
                <Input
                  label="技术栈标题"
                  onChange={(event) => updateAboutDraft({ stackTitle: event.target.value })}
                  value={blogDraft.about.stackTitle}
                />
                <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">技术栈卡片</p>
                  {blogDraft.about.stack.map((item, index) => (
                    <div className="grid gap-3 md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]" key={`stack-${index}`}>
                      <Input
                        label={`技术栈 ${index + 1} 标题`}
                        onChange={(event) => updateAboutCard("stack", index, "title", event.target.value)}
                        value={item.title}
                      />
                      <Input
                        label={`技术栈 ${index + 1} 描述`}
                        onChange={(event) => updateAboutCard("stack", index, "description", event.target.value)}
                        value={item.description}
                      />
                    </div>
                  ))}
                </div>
                <Input
                  label="联系模块标题"
                  onChange={(event) => updateAboutDraft({ contactTitle: event.target.value })}
                  value={blogDraft.about.contactTitle}
                />
                <Textarea
                  label="联系模块描述"
                  onChange={(event) => updateAboutDraft({ contactDescription: event.target.value })}
                  value={blogDraft.about.contactDescription}
                />
                <div className="flex justify-end">
                  <Button disabled={savingBlogSettings} type="submit" variant="outline">
                    {savingBlogSettings ? "保存中..." : "保存博客配置"}
                  </Button>
                </div>
              </div>
            </WorkspacePanel>
          </form>
          ) : null}

          {activeTab === "logs" ? (
          <WorkspacePanel title="日志设置" description="控制后台接口日志表的总占用，超过上限后优先清理最旧日志。">
            <form className="space-y-4" onSubmit={saveLogSettings}>
              <Input
                helperText="默认 10 MB。保存后会立即按新上限裁剪旧日志，保留最新记录。"
                label="日志大小限制"
                min={1}
                max={512}
                onChange={(event) => setLogDraft({ maxStorageMb: event.target.value })}
                rightSlot={<span className="px-2 text-sm font-medium text-[var(--muted)]">MB</span>}
                step="1"
                type="number"
                value={logDraft.maxStorageMb}
              />

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[var(--foreground)]">当前占用</span>
                  <span className="text-[var(--muted)]">
                    {logSettings.currentStorageLabel} / {logSettings.maxStorageMb} MB
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div className="h-full rounded-full bg-[var(--brand)] transition-[width]" style={{ width: `${usagePercent}%` }} />
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">当前保留 {logSettings.rowCount} 条接口日志。</p>
              </div>

              <div className="flex justify-end">
                <Button disabled={savingLogSettings} type="submit">
                  {savingLogSettings ? "保存中..." : "保存日志设置"}
                </Button>
              </div>
            </form>
          </WorkspacePanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
