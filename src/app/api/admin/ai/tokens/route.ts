import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { AI_SCOPES, hashAiToken } from "@/lib/ai-auth";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { prisma } from "@/lib/prisma";

const TOKEN_BYTE_LENGTH = 32;
const MAX_TOKEN_CREATE_ATTEMPTS = 5;

async function POSTHandler() {
  try {
    const session = await requireAdminSession();
    let rawToken = "";
    let tokenPrefix = "";
    let client:
      | {
          id: string;
          name: string;
          scopes: string[];
          createdAt: Date;
        }
      | null = null;

    for (let attempt = 0; attempt < MAX_TOKEN_CREATE_ATTEMPTS; attempt += 1) {
      rawToken = `blog_ai_${randomBytes(TOKEN_BYTE_LENGTH).toString("hex")}`;
      tokenPrefix = rawToken.slice(0, 32);

      try {
        client = await prisma.aiApiClient.create({
          data: {
            name: "Admin UI Token",
            tokenPrefix,
            tokenHash: hashAiToken(rawToken),
            scopes: [...AI_SCOPES],
            ownerId: session.user.id,
          },
          select: {
            id: true,
            name: true,
            scopes: true,
            createdAt: true,
          },
        });
        break;
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
          continue;
        }

        throw error;
      }
    }

    if (!client) {
      throw new Error("Failed to generate a unique AI token");
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          token: rawToken,
          tokenPrefix,
          clientId: client.id,
          name: client.name,
          scopes: client.scopes,
          createdAt: client.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error, "AI token creation failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, {
  scope: "admin",
  operation: "admin.ai.tokens.create",
  route: "/api/admin/ai/tokens",
});
