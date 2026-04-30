import { AI_AUTHORING_ENDPOINTS, AI_AUTHORING_LIMITS } from "@/lib/ai-contract";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const body = [
    "# My Blog AI Authoring",
    "",
    "- Purpose: Create or update unpublished Markdown blog drafts for this site.",
    "- Authentication: Authorization: Bearer <token>",
    `- Discovery: ${baseUrl}${AI_AUTHORING_ENDPOINTS.llms}`,
    `- OpenAPI: ${baseUrl}${AI_AUTHORING_ENDPOINTS.openapi}`,
    `- Draft upsert: POST ${baseUrl}${AI_AUTHORING_ENDPOINTS.drafts}`,
    `- Draft readback: GET ${baseUrl}${AI_AUTHORING_ENDPOINTS.drafts}/{externalId}`,
    `- Live taxonomy: GET ${baseUrl}${AI_AUTHORING_ENDPOINTS.meta}`,
    `- Constraints: externalId must be a path-safe single segment, not '.' or '..'; Markdown body required; title <= ${AI_AUTHORING_LIMITS.titleMaxLength}; excerpt <= ${AI_AUTHORING_LIMITS.excerptMaxLength}; AI drafts are automatically reviewed after upsert; passing reviews can auto-publish, otherwise content remains draft.`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
