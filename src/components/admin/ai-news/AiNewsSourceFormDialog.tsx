"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { Button } from "@/components/admin/ui"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/ui/form"
import { Input } from "@/components/shadcn/ui/input"
import { toErrorMessage } from "@/lib/client-api"

import { aiNewsCategoryLabels, type AiNewsSourceFormState, type AiNewsSourceType, type PublicAiNewsSource } from "./types"

const sourceTypes: Array<{ value: AiNewsSourceType; label: string }> = [
  { value: "RSS", label: "RSS / Atom" },
  { value: "GITHUB_TRENDING_RSS", label: "GitHub Trending RSS" },
  { value: "GITHUB_RELEASES", label: "GitHub Releases" },
  { value: "HACKERNEWS", label: "Hacker News" },
]

const categories = ["official", "industry", "developer", "community", "github-release"]
const adminSelectClassName = "ed-select ed-select--sm"
const adminMonoInputClassName = "font-mono"
// 分组：组标题写法同 AI 批量补全弹窗——.75rem 700 muted 小标题 + 1px 细线
const adminFieldsetClassName = "space-y-4"
const adminLegendClassName = "mb-3 block w-full border-b border-[var(--border)] pb-1.5 text-xs font-bold text-[var(--text-muted)]"
const requiredMark = (
  <span aria-hidden="true" className="ml-1 text-[0.8125rem] font-medium text-[var(--text-muted)]">
    *
  </span>
)
const optionalMark = <span className="ml-1 text-[0.8125rem] font-medium text-[var(--text-muted)]">（可选）</span>

const aiNewsSourceFormSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["RSS", "HACKERNEWS", "GITHUB_RELEASES", "GITHUB_TRENDING_RSS", "REDDIT"]),
    name: z.string().refine((value) => value.trim().length > 0, "请输入来源名称"),
    url: z.string(),
    homepage: z.string(),
    category: z.string(),
    enabled: z.boolean(),
    weight: z.string().refine((value) => {
      const numberValue = Number(value || 50)
      return Number.isFinite(numberValue) && numberValue >= 0 && numberValue <= 200
    }, "权重需在 0 到 200 之间"),
    minScore: z.string().refine((value) => {
      if (!value) return true
      const numberValue = Number(value)
      return Number.isFinite(numberValue) && numberValue >= 0
    }, "最小分数不能小于 0"),
    fetchLimit: z.string().refine((value) => {
      if (!value) return true
      const numberValue = Number(value)
      return Number.isFinite(numberValue) && numberValue >= 1 && numberValue <= 100
    }, "抓取上限需在 1 到 100 之间"),
    commentLimit: z.string().refine((value) => {
      if (!value) return true
      const numberValue = Number(value)
      return Number.isFinite(numberValue) && numberValue >= 0 && numberValue <= 20
    }, "评论条数需在 0 到 20 之间"),
    commentTextMaxLength: z.string().refine((value) => {
      if (!value) return true
      const numberValue = Number(value)
      return Number.isFinite(numberValue) && numberValue >= 80 && numberValue <= 2000
    }, "评论截断长度需在 80 到 2000 之间"),
  })
  .superRefine((values, context) => {
    if (values.type !== "HACKERNEWS" && !values.url.trim()) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "请输入来源 URL",
      })
    }
  })

function settingNumber(source: PublicAiNewsSource | null, key: string, fallback = "") {
  const value = source?.settings?.[key]
  return typeof value === "number" ? String(value) : fallback
}

function emptyForm(): AiNewsSourceFormState {
  return {
    type: "RSS",
    name: "",
    url: "",
    homepage: "",
    category: "industry",
    enabled: true,
    weight: "50",
    minScore: "",
    fetchLimit: "",
    commentLimit: "3",
    commentTextMaxLength: "500",
  }
}

function sourceToForm(source: PublicAiNewsSource | null): AiNewsSourceFormState {
  if (!source) return emptyForm()

  return {
    id: source.id,
    type: source.type,
    name: source.name,
    url: source.url,
    homepage: source.homepage ?? "",
    category: source.category ?? "",
    enabled: source.enabled,
    weight: String(source.weight),
    minScore: source.minScore == null ? "" : String(source.minScore),
    fetchLimit: source.fetchLimit == null ? "" : String(source.fetchLimit),
    commentLimit: settingNumber(source, "commentLimit", "3"),
    commentTextMaxLength: settingNumber(source, "commentTextMaxLength", "500"),
  }
}

export function AiNewsSourceFormDialog({
  open,
  source,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  source: PublicAiNewsSource | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (form: AiNewsSourceFormState) => Promise<void>
}) {
  const form = useForm<AiNewsSourceFormState>({
    resolver: zodResolver(aiNewsSourceFormSchema),
    defaultValues: sourceToForm(source),
  })

  useEffect(() => {
    form.reset(sourceToForm(source))
  }, [form, source])

  const handleSubmit = async (values: AiNewsSourceFormState) => {
    try {
      await onSubmit(values)
      onOpenChange(false)
    } catch (error) {
      toast.error(toErrorMessage(error, "来源保存失败"))
    }
  }

  const sourceType = useWatch({ control: form.control, name: "type" })
  const isHackerNews = sourceType === "HACKERNEWS"
  const sourceId = useWatch({ control: form.control, name: "id" })
  const isSubmitting = form.formState.isSubmitting || saving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{sourceId ? "编辑来源" : "新增来源"}</DialogTitle>
          <DialogDescription>保存后会进入来源库；默认启用表示参与每日自动采集。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-5" noValidate onSubmit={form.handleSubmit(handleSubmit)}>
            <fieldset className={adminFieldsetClassName}>
              <legend className={adminLegendClassName}>基本信息</legend>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>来源类型</FormLabel>
                      <FormControl>
                        <select
                          className={adminSelectClassName}
                          disabled={Boolean(sourceId)}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value as AiNewsSourceType)}
                        >
                          {sourceTypes.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-baseline">
                        <FormLabel>来源名称</FormLabel>
                        {requiredMark}
                      </div>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <div className="flex items-baseline">
                        <FormLabel>{sourceType === "GITHUB_RELEASES" ? "仓库 URL" : "来源 URL"}</FormLabel>
                        {isHackerNews ? optionalMark : requiredMark}
                      </div>
                      <FormControl>
                        <Input
                          className={adminMonoInputClassName}
                          placeholder={sourceType === "GITHUB_RELEASES" ? "https://github.com/vercel/ai" : "https://example.com/feed.xml"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="homepage"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <div className="flex items-baseline">
                        <FormLabel>主页 URL</FormLabel>
                        {optionalMark}
                      </div>
                      <FormControl>
                        <Input className={adminMonoInputClassName} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分类</FormLabel>
                      <FormControl>
                        <select className={adminSelectClassName} {...field}>
                          <option value="">未分类</option>
                          {categories.map((category) => (
                            <option key={category} value={category}>{aiNewsCategoryLabels[category] ?? category}</option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>权重</FormLabel>
                      <FormControl>
                        <Input max={200} min={0} type="number" className={adminMonoInputClassName} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex min-h-7 cursor-pointer items-center gap-2 text-sm font-bold text-[var(--foreground)]">
                      <input
                        checked={field.value}
                        className="ed-checkbox"
                        type="checkbox"
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                      默认参与日报
                    </label>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <fieldset className={adminFieldsetClassName}>
              <legend className={adminLegendClassName}>抓取与校验</legend>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fetchLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>抓取上限</FormLabel>
                      <FormControl>
                        <Input max={100} min={1} type="number" className={adminMonoInputClassName} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="minScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>最小分数</FormLabel>
                      <FormControl>
                        <Input min={0} type="number" className={adminMonoInputClassName} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isHackerNews ? (
                  <>
                    <FormField
                      control={form.control}
                      name="commentLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>评论条数</FormLabel>
                          <FormControl>
                            <Input max={20} min={0} type="number" className={adminMonoInputClassName} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="commentTextMaxLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>评论截断长度</FormLabel>
                          <FormControl>
                            <Input max={2000} min={80} type="number" className={adminMonoInputClassName} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : null}
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "保存中..." : "保存来源"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
