"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button, FallbackImage, Modal } from "@/components/admin/ui";
import { readApiJson } from "@/lib/admin-api-client";
import type { PublicAiModelOption } from "@/lib/ai-models";
import type { CoverAsset } from "./types";

type AiCoverGeneratorProps = {
  title: string;
  excerpt?: string;
  content?: string;
  models?: PublicAiModelOption[];
  onGenerated: (asset: CoverAsset) => void;
};

/**
 * 文章编辑器里的 AI 封面生成入口。
 *
 * 这个组件只负责弹窗交互、可用生图模型选择，以及把生成后的图库资产回传给父级；
 * 生成接口会在服务端完成提示词组装、模型调用、图片上传和图库记录写入。
 */
export function AiCoverGenerator({ title, excerpt, content, models: initialModels, onGenerated }: AiCoverGeneratorProps) {
  const [models, setModels] = useState<PublicAiModelOption[]>(initialModels ?? []);
  const coverModels = useMemo(
    () => models.filter((model) => model.status === "ready" && model.capabilities.includes("cover-image")),
    [models],
  );
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(coverModels[0]?.id ?? "");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<CoverAsset | null>(null);
  const [error, setError] = useState("");

  const selectedModelId = modelId || coverModels[0]?.id || "";

  /**
   * 懒加载模型列表。
   *
   * 当父组件已经传入 models 时直接复用，避免在文章工作台每次打开弹窗都重复请求模型配置。
   */
  const loadModels = async () => {
    if (initialModels) return;
    try {
      const data = await readApiJson(await fetch("/api/admin/ai/models"), "AI 封面生成失败");
      const nextModels = Array.isArray(data.data) ? data.data as PublicAiModelOption[] : [];
      setModels(nextModels);
      if (!modelId) {
        const firstCoverModel = nextModels.find((model) => model.status === "ready" && model.capabilities.includes("cover-image"));
        if (firstCoverModel) setModelId(firstCoverModel.id);
      }
    } catch {
      setModels([]);
    }
  };

  /**
   * 调用封面生成接口并保留返回的 CoverAsset。
   *
   * 返回资产已经写入图库，用户点击“使用”时只需要把 url/id 回填到文章表单。
   */
  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setGenerated(null);

    try {
      const data = await readApiJson(await fetch("/api/admin/covers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          excerpt,
          content,
          prompt,
          modelId: selectedModelId || undefined,
          size: "16:9",
        }),
      }), "AI 封面生成失败");
      setGenerated(data.data as CoverAsset);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "AI 封面生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleUse = () => {
    if (!generated) return;
    onGenerated(generated);
    setOpen(false);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(true); void loadModels(); }}>
        <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" />
        AI 生成封面
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="AI 生成封面" size="3xl" contentClassName="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--muted)]">
          基于当前标题和摘要生成 16:9 文章封面。生成结果会保存到封面图库，并可一键回填到文章。
        </div>

        {coverModels.length > 0 ? (
          <label className="block space-y-2 text-sm font-medium text-[var(--foreground)]">
            <span>生图模型</span>
            <select
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              value={selectedModelId}
              onChange={(event) => setModelId(event.target.value)}
            >
              {coverModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name} · {model.model}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            暂无可用封面生图模型，请先在 AI 模型配置中添加或配置千问 Wan 2.6 生图模型。
          </p>
        )}

        <label className="block space-y-2 text-sm font-medium text-[var(--foreground)]">
          <span>补充风格提示词</span>
          <textarea
            className="ui-ring min-h-28 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            placeholder="例如：暗色科技感、抽象几何、柔和光影、不要人物"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>

        {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        {generated ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="relative aspect-[16/9] bg-[var(--surface-alt)]">
              <FallbackImage alt={generated.alt || "AI 生成封面"} className="object-cover" fill src={generated.url} unoptimized />
            </div>
            <div className="p-3 text-sm text-[var(--muted)]">{generated.url}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button type="button" disabled={generating || coverModels.length === 0 || !title.trim()} onClick={() => void handleGenerate()}>
            {generating ? "生成中..." : "开始生成"}
          </Button>
          <Button type="button" disabled={!generated} onClick={handleUse}>使用这张封面</Button>
        </div>
      </Modal>
    </>
  );
}
