import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

/**
 * 契约：API 目录下的 Route Handler 不得手拼错误 JSON。
 *
 * 失败分支应抛出 `lib/api-errors.ts` 中的语义化错误（ValidationError / TooManyRequestsError /
 * UpstreamError / ApiError 等），由 `toErrorResponse` 统一落成 `{ error }` + 状态码；
 * 操作日志包装器也依赖 `ApiError.status` 推断失败状态码。
 *
 * 允许列表只收录"携带结果负载的状态报告"：响应里除 error 外还有客户端依赖的 data
 * （部分成功字段、失败的 run 记录），它们不是纯错误响应。数量按文件精确锁定，只减不增。
 */
const apiRoot = join(process.cwd(), "src", "app", "api");

const allowedHandBuiltResponses = new Map<string, number>([
  // 部分成功时返回 502 + 已生成字段与失败明细，前端据此渲染"部分成功"状态。
  ["src/app/api/admin/ai/actions/article-info/route.ts", 1],
  // 查询某日 AI 日报运行状态：FAILED 时返回 500 + run 记录，供工作流与后台展示。
  ["src/app/api/cron/ai-news/route.ts", 1],
]);

const HAND_BUILT_ERROR_PATTERN = /(?:NextResponse|Response)\.json\(\s*\{\s*(?:success\s*:\s*false\s*,\s*)?error\s*:/g;

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return findRouteFiles(fullPath);
    }
    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

function countHandBuiltErrors(filePath: string) {
  const source = readFileSync(filePath, "utf8");
  return source.match(HAND_BUILT_ERROR_PATTERN)?.length ?? 0;
}

describe("api error response contract", () => {
  const counts = new Map(
    findRouteFiles(apiRoot).map((filePath) => [
      relative(process.cwd(), filePath).replace(/\\/g, "/"),
      countHandBuiltErrors(filePath),
    ] as const),
  );

  test("route handlers throw semantic errors instead of hand-building error JSON", () => {
    const violations = [...counts.entries()]
      .filter(([file, count]) => count > (allowedHandBuiltResponses.get(file) ?? 0))
      .map(([file, count]) => `${file} (${count})`)
      .sort();

    expect(violations).toEqual([]);
  });

  test("allowlist entries stay exact so the list only shrinks", () => {
    const stale = [...allowedHandBuiltResponses.entries()]
      .filter(([file, allowed]) => (counts.get(file) ?? 0) !== allowed)
      .map(([file]) => file);

    expect(stale).toEqual([]);
  });
});
