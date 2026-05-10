import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { ValidationError } from "@/lib/api-errors";
import { enforceApiOperationLogStorageLimit } from "@/lib/api-operation-log-settings";
import { prisma } from "@/lib/prisma";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ApiOperationLogCreateInput = {
  requestId?: string;
  method: string;
  path: string;
  route?: string | null;
  scope: string;
  operation?: string | null;
  statusCode?: number | null;
  success: boolean;
  durationMs?: number | null;
  actorType?: string | null;
  actorUserId?: string | null;
  actorClientId?: string | null;
  actorLabel?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  query?: JsonValue;
  requestBody?: JsonValue;
  errorName?: string | null;
  errorMessage?: string | null;
  metadata?: JsonValue;
};

export type ApiOperationLogListOptions = {
  cursor?: string | null;
  limit?: unknown;
  range?: unknown;
  from?: string | null;
  to?: string | null;
  method?: string | null;
  status?: string | null;
  success?: string | null;
  scope?: string | null;
  path?: string | null;
  actor?: string | null;
  requestId?: string | null;
  includeSelf?: boolean;
};

const REDACTED = "[REDACTED]";
const MAX_STRING_LENGTH = 1_000;
const MAX_ERROR_LENGTH = 2_000;
const MAX_USER_AGENT_LENGTH = 500;
export const MAX_LOG_JSON_TEXT_LENGTH = 8_192;
const VALID_RANGE_DAYS = [1, 7, 30, 90] as const;
const VALID_PURGE_DAYS = [30, 60, 90] as const;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "passphrase",
  "token",
  "apikey",
  "api_key",
  "key",
  "secret",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "idtoken",
  "id_token",
  "content",
  "body",
  "prompt",
]);

const apiOperationLogModel = () =>
  (prisma as typeof prisma & {
    apiOperationLog?: {
      create: (args: { data: Prisma.ApiOperationLogCreateInput }) => Promise<unknown>;
      count: (args: { where?: Prisma.ApiOperationLogWhereInput }) => Promise<number>;
      findMany: (args: Prisma.ApiOperationLogFindManyArgs) => Promise<ApiOperationLogRecord[]>;
      findUnique: (args: {
        where: { id: string };
      }) => Promise<ApiOperationLogRecord | null>;
      deleteMany: (args: { where: Prisma.ApiOperationLogWhereInput }) => Promise<{ count: number }>;
    };
  }).apiOperationLog;

export type ApiOperationLogRecord = {
  id: string;
  requestId: string;
  method: string;
  path: string;
  route: string | null;
  scope: string;
  operation: string | null;
  statusCode: number | null;
  success: boolean;
  durationMs: number | null;
  actorType: string | null;
  actorUserId: string | null;
  actorClientId: string | null;
  actorLabel: string | null;
  ipHash: string | null;
  userAgent: string | null;
  query: Prisma.JsonValue | null;
  requestBody: Prisma.JsonValue | null;
  errorName: string | null;
  errorMessage: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

function normalizeSensitiveKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function shouldRedactKey(key: string) {
  const normalized = normalizeSensitiveKey(key);
  return SENSITIVE_KEYS.has(normalized) || normalized.endsWith("token") || normalized.endsWith("secret");
}

function truncateString(value: string, maxLength = MAX_STRING_LENGTH) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function toJson(value: JsonValue | undefined) {
  return value === undefined ? undefined : (value as unknown as Prisma.InputJsonValue);
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLimit(value: unknown, fallback = 30) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    return fallback;
  }

  return Math.min(limit, 100);
}

function normalizeRange(value: unknown) {
  const numeric = Number(value);
  return VALID_RANGE_DAYS.includes(numeric as (typeof VALID_RANGE_DAYS)[number]) ? numeric : 7;
}

function normalizeMethod(value: string | null | undefined) {
  const method = value?.trim().toUpperCase();
  return method && /^[A-Z]+$/.test(method) ? method : null;
}

function normalizeBoolean(value: string | null | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function normalizeStatusFilter(value: string | null | undefined): Prisma.ApiOperationLogWhereInput | null {
  if (!value) return null;
  if (value === "2xx") return { statusCode: { gte: 200, lt: 300 } };
  if (value === "3xx") return { statusCode: { gte: 300, lt: 400 } };
  if (value === "4xx") return { statusCode: { gte: 400, lt: 500 } };
  if (value === "5xx") return { statusCode: { gte: 500, lt: 600 } };

  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? { statusCode: numeric } : null;
}

function buildCreatedAtFilter(options: ApiOperationLogListOptions) {
  const from = parseDate(options.from);
  const to = parseDate(options.to);

  if (from || to) {
    return {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const range = normalizeRange(options.range);
  const start = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
  return { gte: start };
}

function buildWhere(options: ApiOperationLogListOptions): Prisma.ApiOperationLogWhereInput {
  const method = normalizeMethod(options.method);
  const success = normalizeBoolean(options.success);
  const statusFilter = normalizeStatusFilter(options.status);
  const scope = options.scope?.trim();
  const path = options.path?.trim();
  const actor = options.actor?.trim();
  const requestId = options.requestId?.trim();

  const and: Prisma.ApiOperationLogWhereInput[] = [
    { createdAt: buildCreatedAtFilter(options) },
    ...(statusFilter ? [statusFilter] : []),
  ];

  if (!options.includeSelf) {
    and.push({ NOT: [{ path: { startsWith: "/api/admin/logs" } }, { path: { startsWith: "/api/internal/operation-logs" } }] });
  }

  if (path) {
    and.push({
      OR: [
        { path: { contains: path, mode: "insensitive" } },
        { operation: { contains: path, mode: "insensitive" } },
        { requestId: { contains: path, mode: "insensitive" } },
      ],
    });
  }

  if (actor) {
    and.push({
      OR: [
        { actorUserId: actor },
        { actorClientId: actor },
        { actorLabel: { contains: actor, mode: "insensitive" } },
        { actorType: { contains: actor, mode: "insensitive" } },
      ],
    });
  }

  return {
    AND: and,
    ...(method ? { method } : {}),
    ...(scope ? { scope } : {}),
    ...(success === null ? {} : { success }),
    ...(requestId ? { requestId: { contains: requestId, mode: "insensitive" } } : {}),
  };
}

export function sanitizeLogPayload(value: unknown, depth = 0): JsonValue {
  if (depth > 6) {
    return "[Max depth reached]";
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeLogPayload(item, depth + 1));
  }

  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      output[key] = shouldRedactKey(key) ? REDACTED : sanitizeLogPayload(item, depth + 1);
    }
    return output;
  }

  return String(value);
}

export function limitLogJson(value: JsonValue | undefined, maxLength = MAX_LOG_JSON_TEXT_LENGTH): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  const text = JSON.stringify(value);
  if (text.length <= maxLength) {
    return value;
  }

  return {
    truncated: true,
    preview: text.slice(0, maxLength),
  };
}

export function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export function getClientIpFromHeaders(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || headers.get("x-real-ip") || null;
}

export function queryToJson(searchParams: URLSearchParams): JsonValue | undefined {
  const query: Record<string, JsonValue> = {};
  searchParams.forEach((value, key) => {
    if (shouldRedactKey(key)) {
      query[key] = REDACTED;
      return;
    }

    if (key in query) {
      const current = query[key];
      query[key] = Array.isArray(current) ? [...current, value] : [current, value];
      return;
    }

    query[key] = truncateString(value);
  });

  return Object.keys(query).length > 0 ? query : undefined;
}

export function publicErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return truncateString(error.message, MAX_ERROR_LENGTH);
  }

  return truncateString(String(error), MAX_ERROR_LENGTH);
}

export async function createApiOperationLog(input: ApiOperationLogCreateInput) {
  if (process.env.NODE_ENV === "test" && process.env.API_OPERATION_LOG_TEST_ENABLE !== "1") {
    return null;
  }

  const model = apiOperationLogModel();
  if (!model) {
    return null;
  }

  try {
    const createdLog = await model.create({
      data: {
        requestId: input.requestId ?? randomUUID(),
        method: input.method,
        path: input.path,
        route: input.route ?? null,
        scope: input.scope,
        operation: input.operation ?? null,
        statusCode: input.statusCode ?? null,
        success: input.success,
        durationMs: input.durationMs ?? null,
        actorType: input.actorType ?? null,
        actorUserId: input.actorUserId ?? null,
        actorClientId: input.actorClientId ?? null,
        actorLabel: input.actorLabel ?? null,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ? truncateString(input.userAgent, MAX_USER_AGENT_LENGTH) : null,
        query: toJson(input.query),
        requestBody: toJson(input.requestBody),
        errorName: input.errorName ?? null,
        errorMessage: input.errorMessage ? truncateString(input.errorMessage, MAX_ERROR_LENGTH) : null,
        metadata: toJson(input.metadata),
      },
    });
    await enforceApiOperationLogStorageLimit().catch((error) => {
      console.error("Enforce API operation log size limit error:", error);
    });

    return createdLog;
  } catch (error) {
    console.error("Create API operation log error:", error);
    return null;
  }
}

export async function listApiOperationLogs(options: ApiOperationLogListOptions) {
  const model = apiOperationLogModel();
  if (!model) {
    return {
      items: [],
      nextCursor: null,
      summary: { totalCount: 0, failedCount: 0, successCount: 0 },
    };
  }

  const pageSize = normalizeLimit(options.limit);
  const where = buildWhere(options);
  const [totalCount, failedCount, rows] = await Promise.all([
    model.count({ where }),
    model.count({ where: { AND: [where, { success: false }] } }),
    model.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;

  return {
    items,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    summary: {
      totalCount,
      failedCount,
      successCount: Math.max(totalCount - failedCount, 0),
    },
  };
}

export async function getApiOperationLog(id: string) {
  const model = apiOperationLogModel();
  if (!model) {
    return null;
  }

  return model.findUnique({ where: { id } });
}

export async function purgeApiOperationLogs(retentionDays: unknown) {
  const days = Number(retentionDays);
  if (!VALID_PURGE_DAYS.includes(days as (typeof VALID_PURGE_DAYS)[number])) {
    throw new ValidationError("Invalid log retention window");
  }

  const model = apiOperationLogModel();
  if (!model) {
    return { count: 0 };
  }

  const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return model.deleteMany({ where: { createdAt: { lt: before } } });
}
