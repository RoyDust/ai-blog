import { AsyncLocalStorage } from "node:async_hooks";

export type ApiOperationActor = {
  actorType: "admin" | "user" | "ai_client" | "anonymous" | "system" | "unknown";
  actorUserId?: string | null;
  actorClientId?: string | null;
  actorLabel?: string | null;
};

export type ApiOperationLogContext = {
  requestId: string;
  scope: string;
  operation?: string | null;
  route?: string | null;
  actor?: ApiOperationActor;
  metadata?: Record<string, unknown>;
};

const operationLogStorage = new AsyncLocalStorage<ApiOperationLogContext>();

export function runApiOperationLogContext<T>(
  context: ApiOperationLogContext,
  callback: () => T,
) {
  return operationLogStorage.run(context, callback);
}

export function getApiOperationLogContext() {
  return operationLogStorage.getStore();
}

export function setApiOperationActor(actor: ApiOperationActor) {
  const context = getApiOperationLogContext();
  if (!context) {
    return;
  }

  context.actor = actor;
}

export function mergeApiOperationMetadata(metadata: Record<string, unknown>) {
  const context = getApiOperationLogContext();
  if (!context) {
    return;
  }

  context.metadata = {
    ...context.metadata,
    ...metadata,
  };
}
