import { NextResponse } from "next/server"

import { setApiOperationError } from "@/lib/api-operation-log-context"
import { scrubUpstreamDiagnostic } from "@/lib/external-reliability"

/**
 * API 路由统一错误抽象。
 *
 * 设计目标：
 * - 业务代码只抛语义化错误，不直接拼 HTTP 响应
 * - 最终由 toErrorResponse 统一落成公开错误契约
 * - 把 Prisma 冲突、缺表、数据库连接失败等基础设施异常收口处理
 */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message)
    this.name = "ValidationError"
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message)
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, message)
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, message)
    this.name = "NotFoundError"
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message)
    this.name = "ConflictError"
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = "Too many requests") {
    super(429, message)
    this.name = "TooManyRequestsError"
  }
}

export class UpstreamError extends ApiError {
  constructor(message = "Upstream service failed") {
    super(502, message)
    this.name = "UpstreamError"
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message = "Service unavailable") {
    super(503, message)
    this.name = "ServiceUnavailableError"
  }
}

/**
 * 识别 Prisma 唯一键冲突错误，常用于 slug / email / 唯一关系写入场景。
 */
export function isPrismaConflictError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

/**
 * P2002 冲突字段的可读提示映射。
 * 配合软删除部分唯一索引使用：部分唯一索引下 P2002 只发生在 active 行之间，
 * 这里给出用户可操作的文案，而不是裸的 "Conflict"。
 */
const UNIQUE_FIELD_HINTS: Array<{ field: string; message: string }> = [
  { field: "slug", message: "该 slug 已被使用，请更换后再试" },
  { field: "name", message: "该名称已被使用，请更换后再试" },
  { field: "url", message: "该资源地址已存在" },
  { field: "email", message: "该邮箱已被使用" },
]

/**
 * 从 Prisma P2002 错误中提取冲突字段名。
 *
 * 两种来源：
 * - meta.target（经典形态）；
 * - Prisma 7 driver adapter 下（部分唯一索引等引擎无法映射的约束），
 *   target 为空、字段藏在 meta.driverAdapterError.cause.constraint.fields 中
 *   ——2026-08-15 已用真实库探针验证该形态。
 */
export function getPrismaConflictTarget(error: unknown): string[] {
  if (typeof error !== "object" || error === null) {
    return []
  }

  const meta = "meta" in error ? (error as { meta?: unknown }).meta : undefined
  if (!meta || typeof meta !== "object") {
    return []
  }

  const toFieldList = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  const target = (meta as { target?: unknown }).target
  const targetFields = toFieldList(target)
  if (targetFields.length > 0) {
    return targetFields
  }

  const driverError = (meta as { driverAdapterError?: unknown }).driverAdapterError
  if (driverError && typeof driverError === "object") {
    const cause = (driverError as { cause?: unknown }).cause
    if (cause && typeof cause === "object") {
      const constraint = (cause as { constraint?: unknown }).constraint
      if (constraint && typeof constraint === "object") {
        return toFieldList((constraint as { fields?: unknown }).fields)
      }
    }
  }

  return []
}

/**
 * 根据冲突字段返回可公开的用户提示；无法识别时返回 null。
 *
 * 优先从 meta.target 解析；部分唯一索引（如 posts_slug_active_unique）由迁移 SQL
 * 手写创建，Prisma 客户端可能无法反推 target 字段，此时退而解析错误消息中的
 * 约束名（`*_active_unique`）或字段列表（`fields: (\`slug\`)`）。
 */
export function getPrismaConflictMessage(error: unknown): string | null {
  const target = getPrismaConflictTarget(error)

  for (const hint of UNIQUE_FIELD_HINTS) {
    if (target.includes(hint.field)) {
      return hint.message
    }
  }

  const message =
    typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  if (message) {
    for (const hint of UNIQUE_FIELD_HINTS) {
      if (message.includes(`\`${hint.field}\``) || message.includes(`${hint.field}_active_unique`)) {
        return hint.message;
      }
    }
  }

  return null
}

/**
 * 识别 Prisma schema 未同步导致的运行时错误。
 */
export function isPrismaMissingSchemaError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  )
}

/**
 * 识别数据库连接层面的瞬时失败，用于返回更可操作的 503 提示。
 */
export function isDatabaseConnectionError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : ""
  const code = "code" in error && typeof error.code === "string" ? error.code : ""

  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    message.includes("Connection terminated unexpectedly") ||
    message.includes("Connection terminated due to connection timeout") ||
    message.includes("timeout exceeded when trying to connect")
  )
}

/**
 * 识别 Prisma 记录不存在错误（update / delete 目标行缺失）。
 */
export function isPrismaNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025"
}

/**
 * 识别请求体 JSON 解析失败产生的 SyntaxError。
 */
export function isJsonSyntaxError(error: unknown): error is SyntaxError {
  return error instanceof SyntaxError || (error instanceof Error && error.name === "SyntaxError")
}

function resolveErrorName(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "name" in error && typeof error.name === "string") {
    const trimmed = error.name.trim()
    if (trimmed) {
      return trimmed
    }
  }

  return fallback
}

/**
 * 清洗未知异常的诊断摘要，供操作审计日志记录，严禁暴露密码、密钥、连接串或 SQL 字面量。
 */
export function scrubErrorDiagnostic(
  error: unknown,
  fallbackMessage = "Internal server error",
  maxLength = 500,
) {
  if (isJsonSyntaxError(error)) {
    return "Invalid JSON payload"
  }

  let text =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : String(error ?? "")

  text = text
    .replace(
      /\b(postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis(?:s)?|amqp(?:s)?):\/\/[^\s<>"',;)\]]+/gi,
      (_match, scheme: string) => `${scheme}://[redacted]`,
    )
    .replace(
      /("(?:password|passphrase|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|cookie|token|private[_-]?key|client[_-]?secret)"\s*:\s*)"(?:\\.|[^"\\])*"/gi,
      '$1"[redacted]"',
    )
    .replace(
      /(\b(?:password|passphrase|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key|client[_-]?secret|cookie|token)\s*[:=]\s*)(?:'[^']*'|"[^"]*"|[^\s,;&"')\]}]+)/gi,
      "$1[redacted]",
    )
    .replace(/(\bVALUES\s*\()[^)]*(\))/gi, "$1[redacted]$2")
    .replace(/(\bparams\s*:\s*\[)[^\]]*(\])/gi, "$1[redacted]$2")
    .replace(/\bBasic\s+[A-Za-z0-9+/=]{6,}\b/gi, "Basic [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{4,}\b/g, "[redacted]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AKIA[0-9A-Z]{16})\b/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted]")

  const scrubbed = scrubUpstreamDiagnostic(text, { maxLength }).trim()
  return scrubbed || fallbackMessage
}

/**
 * 把内部异常转换成稳定的 API 响应。
 *
 * 约定：
 * - 业务错误优先返回精确状态码与可公开消息
 * - 基础设施错误做有限暴露，避免把内部堆栈或 SQL 细节泄漏给客户端
 */
export function toErrorResponse(error: unknown, fallbackMessage = "Internal server error") {
  if (error instanceof ApiError) {
    setApiOperationError({
      errorName: error.name || "ApiError",
      errorMessage: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (isJsonSyntaxError(error)) {
    const message = "Invalid JSON payload"
    setApiOperationError({
      errorName: "SyntaxError",
      errorMessage: message,
    })
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (isPrismaNotFoundError(error)) {
    const message = "Resource not found"
    setApiOperationError({
      errorName: resolveErrorName(error, "PrismaClientKnownRequestError"),
      errorMessage: message,
    })
    return NextResponse.json({ error: message }, { status: 404 })
  }

  if (isPrismaConflictError(error)) {
    const message = getPrismaConflictMessage(error) ?? "Conflict"
    setApiOperationError({
      errorName: resolveErrorName(error, "ConflictError"),
      errorMessage: message,
    })
    return NextResponse.json({ error: message }, { status: 409 })
  }

  if (isPrismaMissingSchemaError(error)) {
    const message = "Database schema is not up to date. Apply pending Prisma migrations."
    setApiOperationError({
      errorName: resolveErrorName(error, "ServiceUnavailableError"),
      errorMessage: message,
    })
    return NextResponse.json({ error: message }, { status: 503 })
  }

  if (isDatabaseConnectionError(error)) {
    const message = "Database connection failed. Please retry shortly."
    setApiOperationError({
      errorName: resolveErrorName(error, "DatabaseConnectionError"),
      errorMessage: message,
    })
    return NextResponse.json({ error: message }, { status: 503 })
  }

  setApiOperationError({
    errorName: resolveErrorName(error, "Error"),
    errorMessage: scrubErrorDiagnostic(error, fallbackMessage),
  })
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
