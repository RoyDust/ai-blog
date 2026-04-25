import { NextResponse } from "next/server"

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

export function isPrismaConflictError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

export function isPrismaMissingSchemaError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  )
}

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

  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
