import { NextResponse } from "next/server";

import { isValidOperationLogIngestSecret } from "@/lib/api-operation-log-ingest-secret";
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
  if (!isValidOperationLogIngestSecret(request.headers.get("x-operation-log-ingest-secret"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
