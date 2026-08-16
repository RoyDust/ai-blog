import { NextResponse } from "next/server";

import {
  isValidOperationLogIngestSecret,
  resolveOperationLogIngestSecret,
} from "@/lib/api-operation-log-ingest-secret";
import { INTERNAL_SECRET_NOT_CONFIGURED_MESSAGE } from "@/lib/internal-secrets";
import {
  createApiOperationLog,
  hashIp,
  limitLogJson,
  queryToJson,
  sanitizeLogPayload,
} from "@/lib/api-operation-logs";

type InternalOperationLogPayload = {
  requestId?: unknown;
  method?: unknown;
  path?: unknown;
  scope?: unknown;
  operation?: unknown;
  statusCode?: unknown;
  errorMessage?: unknown;
  ip?: unknown;
  userAgent?: unknown;
  query?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStatusCode(value: unknown) {
  const statusCode = Number(value);
  return Number.isInteger(statusCode) && statusCode > 0 ? statusCode : 500;
}

function queryFromPayload(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return queryToJson(new URLSearchParams(value.startsWith("?") ? value.slice(1) : value));
}

export async function POST(request: Request) {
  // 密钥未配置（仅生产可能发生）：503，明确区分"配置缺失"与"密钥错误"。
  if (!resolveOperationLogIngestSecret()) {
    return NextResponse.json({ error: INTERNAL_SECRET_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  if (!isValidOperationLogIngestSecret(request.headers.get("x-operation-log-ingest-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as InternalOperationLogPayload;
  const method = asString(body.method) ?? "GET";
  const path = asString(body.path) ?? "/api/internal/operation-logs";
  const statusCode = asStatusCode(body.statusCode);

  await createApiOperationLog({
    requestId: asString(body.requestId) ?? undefined,
    method: method.toUpperCase(),
    path,
    scope: asString(body.scope) ?? "internal",
    operation: asString(body.operation) ?? "internal.operationLog.ingest",
    statusCode,
    success: statusCode < 400,
    durationMs: 0,
    actorType: "unknown",
    ipHash: hashIp(asString(body.ip)),
    userAgent: asString(body.userAgent),
    query: queryFromPayload(body.query),
    errorName: statusCode >= 400 ? "MiddlewareResponse" : null,
    errorMessage: asString(body.errorMessage),
    metadata: limitLogJson(sanitizeLogPayload({ source: "middleware" })),
  });

  return NextResponse.json({ success: true });
}
