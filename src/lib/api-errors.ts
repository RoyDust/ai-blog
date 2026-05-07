import { NextResponse } from "next/server"

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

/**
 * 识别 Prisma 唯一键冲突错误，常用于 slug / email / 唯一关系写入场景。
 */
export function isPrismaConflictError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
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
 * 把内部异常转换成稳定的 API 响应。
 *
 * 约定：
 * - 业务错误优先返回精确状态码与可公开消息
 * - 基础设施错误做有限暴露，避免把内部堆栈或 SQL 细节泄漏给客户端
 */
export function toErrorResponse(error: unknown, fallbackMessage = "Internal server error") {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (isPrismaConflictError(error)) {
    return NextResponse.json({ error: "Conflict" }, { status: 409 })
  }

  if (isPrismaMissingSchemaError(error)) {
    return NextResponse.json({ error: "Database schema is not up to date. Apply pending Prisma migrations." }, { status: 503 })
  }

  if (isDatabaseConnectionError(error)) {
    return NextResponse.json({ error: "Database connection failed. Please retry shortly." }, { status: 503 })
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
