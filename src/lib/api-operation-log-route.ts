import { randomUUID } from "node:crypto";
import { after } from "next/server";

import { ApiError } from "@/lib/api-errors";
import {
  createApiOperationLog,
  getClientIpFromHeaders,
  hashIp,
  limitLogJson,
  MAX_LOG_JSON_TEXT_LENGTH,
  publicErrorMessage,
  queryToJson,
  sanitizeLogPayload,
  type JsonValue,
} from "@/lib/api-operation-logs";
import {
  getApiOperationLogContext,
  runApiOperationLogContext,
  type ApiOperationActor,
  type ApiOperationError,
} from "@/lib/api-operation-log-context";

type ApiRouteHandler<TContext> = (request: Request, context: TContext) => Response | Promise<Response>;
type LoggedApiRoute<TContext> = (request?: Request, context?: TContext) => Promise<Response>;

type MetadataFactory<TContext> =
  | JsonValue
  | ((request: Request, context: TContext) => JsonValue | Promise<JsonValue>);

export type ApiOperationLogRouteOptions<TContext = unknown> = {
  scope: string;
  operation?: string;
  route?: string;
  captureQuery?: boolean;
  captureRequestBody?: boolean;
  metadata?: MetadataFactory<TContext>;
};

function defaultActorForScope(scope: string): ApiOperationActor {
  if (scope === "internal" || scope === "cron") {
    return { actorType: "system" };
  }

  return { actorType: "anonymous" };
}

function shouldCaptureRequestBody(request: Request, enabled: boolean | undefined) {
  if (enabled === false) {
    return false;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return false;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return false;
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_LOG_JSON_TEXT_LENGTH) {
    return false;
  }

  return true;
}

async function readRequestBodySnapshot(request: Request | null): Promise<JsonValue | undefined> {
  if (!request) {
    return undefined;
  }

  try {
    const text = await request.text();
    if (!text.trim()) {
      return undefined;
    }

    try {
      return limitLogJson(sanitizeLogPayload(JSON.parse(text)));
    } catch {
      return limitLogJson({ malformedJson: true, byteLength: Buffer.byteLength(text, "utf8") });
    }
  } catch (error) {
    return {
      captureError: publicErrorMessage(error),
    };
  }
}

function inferStatusCode(response: Response | null, error: unknown) {
  if (response) {
    return response.status;
  }

  return error instanceof ApiError ? error.status : 500;
}

function attachRequestId(response: Response, requestId: string) {
  try {
    response.headers.set("x-request-id", requestId);
  } catch {
    // Some framework/auth responses expose immutable headers. Keep the original
    // response intact instead of re-wrapping a body that may carry cookies.
  }

  return response;
}

async function resolveMetadata<TContext>(
  request: Request,
  context: TContext,
  metadata: MetadataFactory<TContext> | undefined,
) {
  if (!metadata) {
    return undefined;
  }

  const value = typeof metadata === "function" ? await metadata(request, context) : metadata;
  return sanitizeLogPayload(value);
}

function combineLogMetadata(
  storeMetadata: Record<string, unknown> | undefined,
  optionMetadata: JsonValue | undefined,
) {
  if (!storeMetadata && optionMetadata === undefined) {
    return undefined;
  }

  const normalizedOptionMetadata =
    optionMetadata && typeof optionMetadata === "object" && !Array.isArray(optionMetadata)
      ? optionMetadata
      : optionMetadata === undefined
        ? {}
        : { routeMetadata: optionMetadata };

  return sanitizeLogPayload({
    ...(storeMetadata ?? {}),
    ...normalizedOptionMetadata,
  });
}

function resolveLoggedError(caughtError: unknown, storeError: ApiOperationError | undefined) {
  if (caughtError) {
    return {
      errorName: caughtError instanceof Error ? caughtError.name : "Error",
      errorMessage: publicErrorMessage(caughtError),
    };
  }

  return {
    errorName: storeError?.errorName ?? null,
    errorMessage: storeError?.errorMessage ?? null,
  };
}

type AfterScheduler = (task: () => void | Promise<void>) => void;

let customAfterSchedulerForTests: AfterScheduler | null = null;

export function setAfterSchedulerForTests(scheduler: AfterScheduler | null) {
  customAfterSchedulerForTests = scheduler;
}

function isOutsideRequestScopeError(error: unknown) {
  return error instanceof Error && error.message.includes("outside a request scope");
}

export function withApiOperationLogging<TContext = unknown>(
  handler: ApiRouteHandler<TContext>,
  options: ApiOperationLogRouteOptions<TContext>,
): LoggedApiRoute<TContext> {
  return async function loggedApiRoute(request = new Request(`http://localhost${options.route ?? "/api"}`), context?: TContext) {
    const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
    const startedAt = Date.now();
    const url = new URL(request.url);
    const clonedRequest = shouldCaptureRequestBody(request, options.captureRequestBody) ? request.clone() : null;
    const requestBodyPromise = readRequestBodySnapshot(clonedRequest);
    let response: Response | null = null;
    let caughtError: unknown = null;

    return runApiOperationLogContext(
      {
        requestId,
        scope: options.scope,
        operation: options.operation ?? null,
        route: options.route ?? null,
      },
      async () => {
        try {
          response = await handler(request, context as TContext);
          return attachRequestId(response, requestId);
        } catch (error) {
          caughtError = error;
          throw error;
        } finally {
          const durationMs = Date.now() - startedAt;
          const store = getApiOperationLogContext();
          const actor = store?.actor ?? defaultActorForScope(options.scope);
          const statusCode = inferStatusCode(response, caughtError);
          const resolvedRoute = store?.route ?? options.route ?? null;
          const resolvedScope = store?.scope ?? options.scope;
          const resolvedOperation = store?.operation ?? options.operation ?? null;
          const storeMetadata = store?.metadata ? { ...store.metadata } : undefined;
          const loggedError = resolveLoggedError(caughtError, store?.error);
          const ipHash = hashIp(getClientIpFromHeaders(request.headers));
          const userAgent = request.headers.get("user-agent");
          const query = options.captureQuery === false ? undefined : queryToJson(url.searchParams);

          const persistOperationLog = async () => {
            try {
              const requestBody = await requestBodyPromise;
              const optionMetadata = await resolveMetadata(request, context as TContext, options.metadata).catch((error) => ({
                metadataError: publicErrorMessage(error),
              }));
              const metadata = combineLogMetadata(storeMetadata, optionMetadata);

              await createApiOperationLog({
                requestId,
                method: request.method,
                path: url.pathname,
                route: resolvedRoute,
                scope: resolvedScope,
                operation: resolvedOperation,
                statusCode,
                success: statusCode < 400,
                durationMs,
                actorType: actor.actorType,
                actorUserId: actor.actorUserId ?? null,
                actorClientId: actor.actorClientId ?? null,
                actorLabel: actor.actorLabel ?? null,
                ipHash,
                userAgent,
                query,
                requestBody,
                errorName: loggedError.errorName,
                errorMessage: loggedError.errorMessage,
                metadata,
              });
            } catch {
              // Operation log writes are best-effort and must never surface unhandled background rejections.
            }
          };

          const scheduleAfter = customAfterSchedulerForTests ?? after;
          let scheduledInAfter = false;
          try {
            scheduleAfter(persistOperationLog);
            scheduledInAfter = true;
          } catch (afterError) {
            if (!isOutsideRequestScopeError(afterError)) {
              throw afterError;
            }
          }

          if (!scheduledInAfter) {
            await persistOperationLog();
          }
        }
      },
    );
  };
}
