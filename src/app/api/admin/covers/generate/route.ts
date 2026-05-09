import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { generateAiCoverImage, type AiCoverSize } from "@/lib/ai-cover-image";
import { checkAiCoverRateLimit } from "@/lib/rate-limit";

const allowedSizes = new Set<AiCoverSize>(["16:9", "1:1", "4:3"]);

/**
 * 读取可选字符串字段，并限制进入生图提示词的长度。
 */
function optionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * 生成 AI 封面并保存到图库。
 *
 * 该入口会先做限流，再由 generateAiCoverImage 完成模型调用、图片上传和 CoverAsset 创建。
 */
export async function POST(request: Request) {
  try {
    const rateLimit = await checkAiCoverRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    const session = await requireAdminSession();
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const size = allowedSizes.has(payload.size as AiCoverSize) ? payload.size as AiCoverSize : "16:9";

    const asset = await generateAiCoverImage({
      title: optionalString(payload.title, 160) ?? "",
      excerpt: optionalString(payload.excerpt, 500),
      content: optionalString(payload.content, 2000),
      prompt: optionalString(payload.prompt, 500),
      modelId: optionalString(payload.modelId, 160),
      size,
      createdById: session.user.id,
    });

    return NextResponse.json({ success: true, data: asset });
  } catch (error) {
    return toErrorResponse(error);
  }
}
