"use client";

import { motion, useReducedMotion } from "motion/react";
import type { UseFormReturn } from "react-hook-form";

import { FramedInput } from "@/components/admin/workspace/WorkspaceKit";
import { editorialEase } from "@/components/editorial";
import { Form, FormControl, FormField } from "@/components/shadcn/ui/form";
import { SettingsFieldItem, SettingsSaveRow, SettingsSection } from "./SettingsFormParts";
import type { LogSettingsFormValues, OperationLogSettings } from "./settings-shared";

type LogSettingsPanelProps = {
  logForm: UseFormReturn<LogSettingsFormValues>;
  logSettings: OperationLogSettings;
  usagePercent: number;
  onSubmit: () => void;
};

/**
 * 「日志策略」设置面板（方向 A 第 15 节 F2）：240px 数字框 + 后缀「MB」（越界时 danger 边框 + 错误文案），
 * 细线下方「当前占用」等宽「6.2 / 10 MB」+ 8px 进度条（chart2 色，role=meter）+ 保留条数。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function LogSettingsPanel({ logForm, logSettings, usagePercent, onSubmit }: LogSettingsPanelProps) {
  const reduceMotion = useReducedMotion();
  const [currentValue, ...currentUnitParts] = logSettings.currentStorageLabel.split(" ");
  const currentUnit = currentUnitParts.join(" ");

  return (
    <SettingsSection title="日志设置" description="控制后台接口日志表的总占用，超过上限后优先清理最旧日志。">
      <Form {...logForm}>
        <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
          <FormField
            control={logForm.control}
            name="maxStorageMb"
            render={({ field, fieldState }) => (
              <SettingsFieldItem
                label="日志大小限制"
                required
                description={fieldState.error ? undefined : "默认 10 MB。保存后会立即按新上限裁剪旧日志，保留最新记录。"}
              >
                <FormControl>
                  <FramedInput
                    className="w-60"
                    inputClassName="font-mono"
                    invalid={Boolean(fieldState.error)}
                    min={1}
                    max={512}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(Number(event.target.value) || 1)}
                    step="1"
                    suffix={<span className="pr-1.5 text-[0.8125rem] text-[var(--text-muted)]">MB</span>}
                    type="number"
                    value={field.value}
                  />
                </FormControl>
              </SettingsFieldItem>
            )}
          />

          <div className="border-t border-[var(--border)] pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] text-[var(--text-body)]">当前占用</span>
              <span className="font-mono text-[var(--foreground)] tabular-nums">
                <span className="text-xl font-bold">{currentValue}</span>
                {currentUnit && currentUnit !== "MB" ? <span className="text-xs text-[var(--text-muted)]"> {currentUnit}</span> : null}
                <span className="text-[var(--text-muted)]"> / </span>
                <span className="text-xl font-bold">{logSettings.maxStorageMb}</span>
                <span className="font-sans text-xs text-[var(--text-muted)]"> MB</span>
              </span>
            </div>
            <div
              role="meter"
              aria-label="日志占用"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={usagePercent}
              aria-valuetext={`${logSettings.currentStorageLabel} / ${logSettings.maxStorageMb} MB`}
              className="mt-2.5 h-2 overflow-hidden rounded-[2px] bg-[var(--ed-skeleton)]"
            >
              <motion.div
                className="h-full bg-[var(--chart2)]"
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.6, ease: editorialEase }}
              />
            </div>
            <p className="mt-2.5 text-[0.8125rem] text-[var(--text-muted)]">
              当前保留 <span className="font-mono text-[var(--foreground)]">{logSettings.rowCount.toLocaleString("zh-CN")}</span> 条接口日志。
            </p>
          </div>

          <SettingsSaveRow label="保存日志设置" submitting={logForm.formState.isSubmitting} />
        </form>
      </Form>
    </SettingsSection>
  );
}
