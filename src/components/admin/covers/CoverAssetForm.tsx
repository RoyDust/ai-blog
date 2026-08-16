"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/admin/ui";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { apiMutate, toErrorMessage } from "@/lib/client-api";
import type { CoverAsset } from "./types";

type CoverAssetFormProps = {
  asset?: CoverAsset | null;
  onSaved: (asset: CoverAsset) => void;
  onCancel?: () => void;
};

const adminSelectTriggerClassName = "w-full rounded-xl border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const adminSelectContentClassName = "rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";
const adminInputClassName = "rounded-xl border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const adminTextareaClassName = "ui-ring min-h-24 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const adminLabelClassName = "text-sm font-medium text-[var(--foreground)]";
const adminMessageClassName = "text-xs text-rose-500";

const coverAssetFormSchema = z.object({
  url: z.string(),
  title: z.string(),
  alt: z.string(),
  description: z.string(),
  tags: z.string(),
  status: z.enum(["active", "archived"]),
});

type CoverAssetFormValues = z.infer<typeof coverAssetFormSchema>;

/**
 * 把用户输入的标签文本拆成后端期望的字符串数组。
 *
 * 同时支持英文逗号、中文逗号和空白分隔，方便从旧素材备注里直接粘贴。
 */
function splitTags(value: string) {
  return value
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formDefaults(asset?: CoverAsset | null): CoverAssetFormValues {
  return {
    url: asset?.url ?? "",
    title: asset?.title ?? "",
    alt: asset?.alt ?? "",
    description: asset?.description ?? "",
    tags: asset?.tags?.join(", ") ?? "",
    status: asset?.status === "archived" ? "archived" : "active",
  };
}

/**
 * 封面资产新增/编辑表单。
 *
 * 新增模式写入外链封面；编辑模式只修改元信息和状态，避免误改已经被文章引用的 URL。
 */
export function CoverAssetForm({ asset, onSaved, onCancel }: CoverAssetFormProps) {
  const isEditing = Boolean(asset);
  const schema = useMemo(
    () =>
      coverAssetFormSchema.superRefine((values, context) => {
        if (!isEditing && !values.url.trim()) {
          context.addIssue({
            code: "custom",
            path: ["url"],
            message: "请输入图片 URL",
          });
        }
      }),
    [isEditing],
  );
  const form = useForm<CoverAssetFormValues>({
    resolver: zodResolver(schema),
    defaultValues: formDefaults(asset),
  });

  useEffect(() => {
    form.reset(formDefaults(asset));
  }, [asset, form]);

  /**
   * 根据是否传入 asset 决定调用新增或更新接口。
   *
   * 成功后把最新资产交给父级列表做本地合并，表单自身不负责重新拉取整页数据。
   */
  const handleSubmit = async (values: CoverAssetFormValues) => {
    try {
      const endpoint = asset ? `/api/admin/covers/${asset.id}` : "/api/admin/covers";
      const payload = asset
        ? {
            title: values.title,
            alt: values.alt,
            description: values.description,
            tags: splitTags(values.tags),
            status: values.status,
          }
        : {
            url: values.url.trim(),
            provider: "manual",
            source: "manual",
            title: values.title,
            alt: values.alt,
            description: values.description,
            tags: splitTags(values.tags),
          };
      const data = await apiMutate<{ data?: CoverAsset }>(endpoint, {
        method: asset ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      if (data.data) {
        onSaved(data.data);
      }

      if (!asset) {
        form.reset(formDefaults(null));
      }
    } catch (err) {
      toast.error(toErrorMessage(err, "保存封面失败"));
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={form.handleSubmit(handleSubmit)}>
        {!asset ? (
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={adminLabelClassName}>图片 URL</FormLabel>
                <FormControl>
                  <Input
                    className={adminInputClassName}
                    placeholder="https://cdn.example.com/covers/image.jpg"
                    {...field}
                  />
                </FormControl>
                <FormMessage className={adminMessageClassName} />
              </FormItem>
            )}
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={adminLabelClassName}>标题</FormLabel>
                <FormControl>
                  <Input className={adminInputClassName} placeholder="后台识别名称" {...field} />
                </FormControl>
                <FormMessage className={adminMessageClassName} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="alt"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={adminLabelClassName}>替代文本</FormLabel>
                <FormControl>
                  <Input className={adminInputClassName} placeholder="用于图片 alt" {...field} />
                </FormControl>
                <FormMessage className={adminMessageClassName} />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={adminLabelClassName}>备注</FormLabel>
              <FormControl>
                <Textarea
                  className={adminTextareaClassName}
                  placeholder="记录适合的文章主题、风格或使用注意事项"
                  {...field}
                />
              </FormControl>
              <FormMessage className={adminMessageClassName} />
            </FormItem>
          )}
        />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={adminLabelClassName}>标签</FormLabel>
                <FormControl>
                  <Input className={adminInputClassName} placeholder="tech, hero, dark" {...field} />
                </FormControl>
                <FormMessage className={adminMessageClassName} />
              </FormItem>
            )}
          />
          {asset ? (
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={adminLabelClassName}>状态</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className={adminSelectTriggerClassName}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className={adminSelectContentClassName}>
                      <SelectItem value="active">可用</SelectItem>
                      <SelectItem value="archived">归档</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className={adminMessageClassName} />
                </FormItem>
              )}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "保存中..." : asset ? "保存封面" : "加入图库"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
