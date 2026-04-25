import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { getAiModelForCapability } from "@/lib/ai-models"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"
import { generatePostSummary } from "@/lib/post-summary"

export async function POST(request: Request) {
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
      return NextResponse.json({ error: `${aiModel.apiKeyEnv} is not configured` }, { status: 500 })
    }

    let summary: string
    try {
      summary = await generatePostSummary({ aiModel, title: body.title, content })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Summary generation failed" },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, data: { summary, modelId: aiModel.id } })
  } catch (error) {
    return toErrorResponse(error, "Summary generation failed")
  }
}
