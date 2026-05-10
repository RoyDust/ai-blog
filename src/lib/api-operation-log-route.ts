import { randomUUID } from "node:crypto";

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
      return limitLogJson({ malformedJson: true, preview: text.slice(0, 512) });
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
          const store = getApiOperationLogContext();
          const actor = store?.actor ?? defaultActorForScope(options.scope);
          const statusCode = inferStatusCode(response, caughtError);
          const requestBody = await requestBodyPromise;
          const optionMetadata = await resolveMetadata(request, context as TContext, options.metadata).catch((error) => ({
            metadataError: publicErrorMessage(error),
          }));
          const metadataInput =
            store?.metadata || optionMetadata !== undefined
              ? {
                  ...(store?.metadata ?? {}),
                  ...(optionMetadata && typeof optionMetadata === "object" && !Array.isArray(optionMetadata)
                    ? optionMetadata
                    : optionMetadata === undefined
                      ? {}
                      : { routeMetadata: optionMetadata }),
                }
              : undefined;
          const metadata = metadataInput ? sanitizeLogPayload(metadataInput) : undefined;

          await createApiOperationLog({
            requestId,
            method: request.method,
            path: url.pathname,
            route: store?.route ?? options.route ?? null,
            scope: store?.scope ?? options.scope,
            operation: store?.operation ?? options.operation ?? null,
            statusCode,
            success: statusCode < 400,
            durationMs: Date.now() - startedAt,
            actorType: actor.actorType,
            actorUserId: actor.actorUserId ?? null,
            actorClientId: actor.actorClientId ?? null,
            actorLabel: actor.actorLabel ?? null,
            ipHash: hashIp(getClientIpFromHeaders(request.headers)),
            userAgent: request.headers.get("user-agent"),
            query: queryToJson(url.searchParams),
            requestBody,
            errorName: caughtError instanceof Error ? caughtError.name : caughtError ? "Error" : null,
            errorMessage: caughtError ? publicErrorMessage(caughtError) : null,
            metadata,
          });
        }
      },
    );
  };
}
