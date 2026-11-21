import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const checkUploadRateLimit = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => ({ user: { id: "admin-1", role: "ADMIN" } })),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  checkUploadRateLimit: (...args: unknown[]) => checkUploadRateLimit(...args),
}));

function decodePutPolicyFromToken(token: string) {
  const parts = token.split(":");
  expect(parts).toHaveLength(3);
  const json = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

describe("POST /api/admin/uploads/qiniu-token", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    checkUploadRateLimit.mockReset().mockResolvedValue({ allowed: true });
    process.env.QINIU_ACCESS_KEY = "test-ak";
    process.env.QINIU_SECRET_KEY = "test-sk";
    process.env.QINIU_BUCKET = "test-bucket";
    process.env.QINIU_DOMAIN = "https://cdn.example.com";
    delete process.env.QINIU_UPLOAD_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("issues scoped upload token with 10 MiB fsizeLimit and strict raster mimeLimit", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "Cover Photo.WEBP", contentType: "image/webp" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.key).toMatch(/^covers\/\d+-[a-f0-9]{8}-cover-photo\.webp$/);
    expect(body.data.domain).toBe("https://cdn.example.com");
    expect(body.data.uploadUrl).toBe("https://upload.qiniup.com");

    const policy = decodePutPolicyFromToken(body.data.token);
    expect(policy).toMatchObject({
      scope: `test-bucket:${body.data.key}`,
      fsizeLimit: 10 * 1024 * 1024,
      mimeLimit: "image/webp",
    });

    const jpegResponse = await POST(
      new Request("http://localhost/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "photo.jpeg" }),
      }),
    );
    const jpegBody = await jpegResponse.json();
    expect(jpegResponse.status).toBe(200);
    expect(decodePutPolicyFromToken(jpegBody.data.token).mimeLimit).toBe("image/jpeg");
  });

  test.each([
    { filename: "xss.svg", contentType: "image/svg+xml" },
    { filename: "xss.svg" },
    { filename: "payload.html", contentType: "text/html" },
    { filename: "script.js" },
    { filename: "missing-extension" },
    { filename: "../escape.png", contentType: "image/png" },
    { filename: "a.b/../../x.png", contentType: "image/png" },
    { filename: "folder\\escape.png", contentType: "image/png" },
    { filename: "null\0byte.png", contentType: "image/png" },
    { filename: "mismatch.png", contentType: "image/webp" },
  ])("returns 400 ValidationError for unsafe upload request: $filename", async (payload) => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: expect.any(String) });
  });

  test("returns 429 when upload rate limit is exceeded", async () => {
    checkUploadRateLimit.mockResolvedValueOnce({ allowed: false });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "cover.png", contentType: "image/png" }),
      }),
    );

    expect(response.status).toBe(429);
  });

  test("returns 500 when Qiniu environment variables are missing", async () => {
    delete process.env.QINIU_SECRET_KEY;

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "cover.png", contentType: "image/png" }),
      }),
    );

    expect(response.status).toBe(500);
  });
});
