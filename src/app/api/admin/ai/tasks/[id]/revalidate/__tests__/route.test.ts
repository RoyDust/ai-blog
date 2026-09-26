import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), recover: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAdminSession: mocks.auth }));
vi.mock("@/lib/ai-task-cache-recovery", () => ({ revalidateAiTaskContent: mocks.recover }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } }); mocks.recover.mockResolvedValue({ taskId: "task-1", complete: true, paths: ["/posts/one"], errors: [], missingEvidence: [] }); });
const request = () => new Request("http://localhost/api/admin/ai/tasks/task-1/revalidate", { method: "POST" });
test("requires an admin before touching cache recovery", async () => {
  const { UnauthorizedError } = await import("@/lib/api-errors");
  mocks.auth.mockRejectedValueOnce(new UnauthorizedError());
  const { POST } = await import("../route");
  const response = await POST(request(), { params: Promise.resolve({ id: "task-1" }) });
  expect(response.status).toBe(401); expect(mocks.recover).not.toHaveBeenCalled();
});
test("returns a complete cache-only report", async () => {
  const { POST } = await import("../route");
  const response = await POST(request(), { params: Promise.resolve({ id: "task-1" }) });
  expect(response.status).toBe(200); expect(mocks.recover).toHaveBeenCalledWith("task-1");
  expect(await response.json()).toMatchObject({ success: true, data: { complete: true, paths: ["/posts/one"] } });
});
test("reports a partial refresh explicitly instead of claiming complete success", async () => {
  mocks.recover.mockResolvedValue({ taskId: "task-1", complete: false, paths: ["/posts/one"], errors: [{ path: "/posts/one", error: "cache unavailable" }], missingEvidence: [{ itemId: "legacy", fields: ["seriesSlug"] }] });
  const { POST } = await import("../route");
  const response = await POST(request(), { params: Promise.resolve({ id: "task-1" }) });
  expect(response.status).toBe(207); expect(await response.json()).toMatchObject({ data: { complete: false, errors: [{ path: "/posts/one", error: "cache unavailable" }] } });
});
