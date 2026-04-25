import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { AiModelManager } from "@/components/admin/ai/AiModelManager";
import { getPublicAiModelOptions } from "@/lib/ai-models";

export const dynamic = "force-dynamic";

export default async function AdminAiModelsPage() {
  const models = await getPublicAiModelOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI"
        title="AI 模型管理"
        description="集中管理后台 AI 能力使用的 OpenAI 兼容模型，支持新增、修改、删除、测试连接和设置摘要默认模型。"
      />

      <AiModelManager initialModels={models} />
    </div>
  );
}
