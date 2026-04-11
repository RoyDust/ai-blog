import { NextResponse } from "next/server";

import { AI_AUTHORING_ENDPOINTS, AI_AUTHORING_LIMITS, AI_AUTHORING_VERSION } from "@/lib/ai-contract";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "My Blog AI Authoring API",
      version: AI_AUTHORING_VERSION,
      description: "Machine-facing endpoints for AI clients to read taxonomy and upsert unpublished Markdown drafts.",
    },
    servers: [{ url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: {
        AiDraftInput: {
          type: "object",
          required: ["externalId", "title", "slug", "content"],
          properties: {
            externalId: { type: "string" },
            title: { type: "string", maxLength: AI_AUTHORING_LIMITS.titleMaxLength },
            slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
            content: { type: "string", description: "Markdown article body" },
            excerpt: { type: "string", maxLength: AI_AUTHORING_LIMITS.excerptMaxLength },
            coverImage: { type: "string" },
            categorySlug: { type: "string" },
            tagSlugs: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
    paths: {
      [AI_AUTHORING_ENDPOINTS.meta]: {
        get: {
          security: [{ bearerAuth: ["taxonomy:read"] }],
          responses: {
            "200": { description: "Authoring metadata and taxonomy" },
          },
        },
      },
      [AI_AUTHORING_ENDPOINTS.drafts]: {
        post: {
          security: [{ bearerAuth: ["drafts:write"] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AiDraftInput" },
              },
            },
          },
          responses: {
            "201": { description: "Draft created" },
            "200": { description: "Draft updated" },
          },
        },
      },
      "/api/ai/drafts/{externalId}": {
        get: {
          security: [{ bearerAuth: ["drafts:read"] }],
          parameters: [
            {
              name: "externalId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Stored draft" },
          },
        },
      },
    },
  });
}
