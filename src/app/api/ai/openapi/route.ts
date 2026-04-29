import { NextResponse } from "next/server";

import {
  AI_AUTHORING_ENDPOINTS,
  AI_AUTHORING_LIMITS,
  AI_AUTHORING_PATTERNS,
  AI_AUTHORING_VERSION,
} from "@/lib/ai-contract";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "My Blog AI Authoring API",
      version: AI_AUTHORING_VERSION,
      description: "Machine-facing endpoints for AI clients to read taxonomy and upsert Markdown drafts that can auto-publish after AI review.",
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
        AiErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
          },
        },
        AiDraftInput: {
          type: "object",
          required: ["externalId", "title", "slug", "content"],
          properties: {
            externalId: {
              type: "string",
              pattern: AI_AUTHORING_PATTERNS.externalId,
              description: "Path-safe external draft identifier using RFC 3986 unreserved characters, excluding '.' and '..'.",
            },
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
        AiDraft: {
          type: "object",
          required: [
            "externalId",
            "postId",
            "title",
            "slug",
            "content",
            "excerpt",
            "coverImage",
            "readingTimeMinutes",
            "categorySlug",
            "tagSlugs",
          ],
          properties: {
            externalId: {
              type: "string",
              pattern: AI_AUTHORING_PATTERNS.externalId,
            },
            postId: { type: "string" },
            title: { type: "string" },
            slug: { type: "string" },
            content: { type: "string" },
            excerpt: { type: ["string", "null"] },
            coverImage: { type: ["string", "null"] },
            readingTimeMinutes: { type: "integer", minimum: 0 },
            categorySlug: { type: ["string", "null"] },
            tagSlugs: {
              type: "array",
              items: { type: "string" },
            },
            published: { type: "boolean" },
          },
        },
        AiAutoReview: {
          type: ["object", "null"],
          properties: {
            verdict: { type: "string", enum: ["ready", "needs-work"] },
            score: { type: "number" },
            summary: { type: "string" },
            published: { type: "boolean" },
            error: { type: "string" },
          },
        },
        AiMetaResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", enum: [true] },
            data: {
              type: "object",
              required: ["version", "limits", "categories", "tags"],
              properties: {
                version: { type: "string" },
                limits: {
                  type: "object",
                  required: [
                    "excerptMaxLength",
                    "titleMaxLength",
                    "supportsMarkdown",
                    "publishRequiresHumanReview",
                    "autoPublishRequiresAiReview",
                    "autoPublishMinimumScore",
                  ],
                  properties: {
                    excerptMaxLength: { type: "number" },
                    titleMaxLength: { type: "number" },
                    supportsMarkdown: { type: "boolean" },
                    publishRequiresHumanReview: { type: "boolean" },
                    autoPublishRequiresAiReview: { type: "boolean" },
                    autoPublishMinimumScore: { type: "number" },
                  },
                },
                categories: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["name", "slug", "postCount"],
                    properties: {
                      name: { type: "string" },
                      slug: { type: "string" },
                      postCount: { type: "number" },
                    },
                  },
                },
                tags: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["name", "slug", "postCount"],
                    properties: {
                      name: { type: "string" },
                      slug: { type: "string" },
                      postCount: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
        AiDraftUpsertResponse: {
          type: "object",
          required: ["success", "operation", "data"] ,
          properties: {
            success: { type: "boolean", enum: [true] },
            operation: { type: "string", enum: ["created", "updated"] },
            data: { $ref: "#/components/schemas/AiDraft" },
            autoReview: { $ref: "#/components/schemas/AiAutoReview" },
          },
        },
        AiDraftResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", enum: [true] },
            data: { $ref: "#/components/schemas/AiDraft" },
          },
        },
      },
    },
    paths: {
      [AI_AUTHORING_ENDPOINTS.meta]: {
        get: {
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Authoring metadata and taxonomy",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiMetaResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "500": {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
          },
        },
      },
      [AI_AUTHORING_ENDPOINTS.drafts]: {
        post: {
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AiDraftInput" },
              },
            },
          },
          responses: {
            "201": {
              description: "Draft created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiDraftUpsertResponse" },
                },
              },
            },
            "200": {
              description: "Draft updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiDraftUpsertResponse" },
                },
              },
            },
            "400": {
              description: "Malformed JSON or validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "409": {
              description: "Conflict",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "500": {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/ai/drafts/{externalId}": {
        get: {
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "externalId",
              in: "path",
              required: true,
              schema: {
                type: "string",
                pattern: AI_AUTHORING_PATTERNS.externalId,
              },
            },
          ],
          responses: {
            "200": {
              description: "Stored draft",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiDraftResponse" },
                },
              },
            },
            "400": {
              description: "Invalid externalId",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
            "500": {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AiErrorResponse" },
                },
              },
            },
          },
        },
      },
    },
  });
}
