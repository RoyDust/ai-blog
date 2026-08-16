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

import type { AiNewsSourceFormState, AiNewsSourceType, PublicAiNewsSource } from "./types"

const sourceTypes: Array<{ value: AiNewsSourceType; label: string }> = [
  { value: "RSS", label: "RSS / Atom" },
  { value: "GITHUB_TRENDING_RSS", label: "GitHub Trending RSS" },
  { value: "GITHUB_RELEASES", label: "GitHub Releases" },
  { value: "HACKERNEWS", label: "Hacker News" },
]

const categories = ["official", "industry", "developer", "community", "github-release"]
const adminInputClassName = "rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
const adminLabelClassName = "text-sm font-medium text-[var(--foreground)]"
const adminMessageClassName = "text-xs text-rose-500"

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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{sourceId ? "编辑来源" : "新增来源"}</DialogTitle>
          <DialogDescription>保存后会进入来源库；默认启用表示参与每日自动采集。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" noValidate onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={adminLabelClassName}>来源类型</FormLabel>
                    <FormControl>
                      <select
                        className={adminInputClassName}
                        disabled={Boolean(sourceId)}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value as AiNewsSourceType)}
                      >
                        {sourceTypes.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage className={adminMessageClassName} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={adminLabelClassName}>来源名称</FormLabel>
                    <FormControl>
                      <Input className={adminInputClassName} {...field} />
                    </FormControl>
                    <FormMessage className={adminMessageClassName} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={adminLabelClassName}>{sourceType === "GITHUB_RELEASES" ? "仓库 URL" : "来源 URL"}</FormLabel>
                    <FormControl>
                      <Input
                        className={adminInputClassName}
                        placeholder={sourceType === "GITHUB_RELEASES" ? "https://github.com/vercel/ai" : "https://example.com/feed.xml"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className={adminMessageClassName} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="homepage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={adminLabelClassName}>主页 URL</FormLabel>
                    <FormControl>
                      <Input className={adminInputClassName} {...field} />
                    </FormControl>
                    <FormMessage className={adminMessageClassName} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={adminLabelClassName}>分类</FormLabel>
                    <FormControl>
                      <select className={adminInputClassName} {...field}>
                        <option value="">未分类</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage className={adminMessageClassName} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={adminLabelClassName}>权重</FormLabel>
                    <FormControl>
                      <Input className={adminInputClassName} max={200} min={0} type="number" {...field} />
                    </FormControl>
                    <FormMessage className={adminMessageClassName} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fetchLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={adminLabelClassName}>抓取上限</FormLabel>
                    <FormControl>
                      <Input className={adminInputClassName} max={100} min={1} type="number" {...field} />
                    </FormControl>
                    <FormMessage className={adminMessageClassName} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={adminLabelClassName}>最小分数</FormLabel>
                    <FormControl>
                      <Input className={adminInputClassName} min={0} type="number" {...field} />
                    </FormControl>
                    <FormMessage className={adminMessageClassName} />
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
                        <FormLabel className={adminLabelClassName}>评论条数</FormLabel>
                        <FormControl>
                          <Input className={adminInputClassName} max={20} min={0} type="number" {...field} />
                        </FormControl>
                        <FormMessage className={adminMessageClassName} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="commentTextMaxLength"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={adminLabelClassName}>评论截断长度</FormLabel>
                        <FormControl>
                          <Input className={adminInputClassName} max={2000} min={80} type="number" {...field} />
                        </FormControl>
                        <FormMessage className={adminMessageClassName} />
                      </FormItem>
                    )}
                  />
                </>
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                    <input
                      checked={field.value}
                      className="ui-checkbox h-4 w-4"
                      type="checkbox"
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                    默认参与日报
                  </label>
                  <FormMessage className={adminMessageClassName} />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "保存中" : "保存来源"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
