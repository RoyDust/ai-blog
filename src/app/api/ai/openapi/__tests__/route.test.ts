import { describe, expect, test } from "vitest";

describe("GET /api/ai/openapi", () => {
  test("returns the ai authoring OpenAPI document", async () => {
    const { GET } = await import("../route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.openapi).toBe("3.1.0");
    expect(payload.paths["/api/ai/drafts"]).toBeDefined();
    expect(payload.components.securitySchemes.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
    });
    expect(payload.paths["/api/ai/meta"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(payload.paths["/api/ai/drafts"].post.security).toEqual([{ bearerAuth: [] }]);
    expect(payload.paths["/api/ai/drafts/{externalId}"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(payload.components.schemas.AiMetaResponse).toBeDefined();
    expect(payload.components.schemas.AiDraft.properties.externalId).toEqual({
      type: "string",
      pattern: "^(?!\\.{1,2}$)[A-Za-z0-9._~-]+$",
    });
    expect(payload.components.schemas.AiDraftInput.properties.externalId.pattern).toBe("^(?!\\.{1,2}$)[A-Za-z0-9._~-]+$");
    expect(payload.paths["/api/ai/drafts/{externalId}"].get.parameters[0].schema.pattern).toBe("^(?!\\.{1,2}$)[A-Za-z0-9._~-]+$");
    expect(payload.paths["/api/ai/meta"].get.responses["200"].content).toBeDefined();
    expect(payload.paths["/api/ai/meta"].get.responses["500"].content).toBeDefined();
    expect(payload.paths["/api/ai/drafts"].post.responses["201"].content).toBeDefined();
    expect(payload.paths["/api/ai/drafts/{externalId}"].get.responses["200"].content).toBeDefined();
    expect(payload.paths["/api/ai/drafts/{externalId}"].get.responses["500"].content).toBeDefined();
  });
});
