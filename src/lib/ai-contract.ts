export const AI_AUTHORING_VERSION = "2026-04-12";

export const AI_AUTHORING_LIMITS = {
  excerptMaxLength: 320,
  titleMaxLength: 160,
  supportsMarkdown: true,
  publishRequiresHumanReview: true,
} as const;

export const AI_AUTHORING_PATTERNS = {
  externalId: "^(?!\\.{1,2}$)[A-Za-z0-9._~-]+$",
} as const;

export const AI_AUTHORING_ENDPOINTS = {
  meta: "/api/ai/meta",
  drafts: "/api/ai/drafts",
  openapi: "/api/ai/openapi",
  llms: "/llms.txt",
} as const;
