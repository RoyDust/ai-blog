import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { getAiModelForCapability } from "@/lib/ai-models"
import { ApiError, toErrorResponse, UpstreamError, ValidationError } from "@/lib/api-errors"
import { generatePostSummary } from "@/lib/post-summary"

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession()

    const body = (await request.json()) as { title?: string; content?: string; modelId?: string }
    const content = body.content?.trim()

    if (!content) {
      throw new ValidationError("Article content is required")
    }

    const aiModel = await getAiModelForCapability("post-summary", body.modelId)
    if (!aiModel) {
      throw new ValidationError("AI model is not available for post summaries")
    }

    if (!aiModel.apiKey) {
      throw new ApiError(500, `${aiModel.apiKeyEnv} is not configured`)
    }

    let summary: string
    try {
      summary = await generatePostSummary({ aiModel, title: body.title, content })
    } catch (error) {
      throw new UpstreamError(error instanceof Error ? error.message : "Summary generation failed")
    }

    return NextResponse.json({ success: true, data: { summary, modelId: aiModel.id } })
  } catch (error) {
    return toErrorResponse(error, "Summary generation failed")
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.posts.summarize.create', route: '/api/admin/posts/summarize' });
