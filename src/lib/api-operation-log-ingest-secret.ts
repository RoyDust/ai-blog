import { resolveAuthSecret } from "@/lib/auth-secret";

const DEV_INGEST_SECRET = "development-operation-log-ingest";

export function resolveOperationLogIngestSecret() {
  return process.env.OPERATION_LOG_INGEST_SECRET || resolveAuthSecret() || (process.env.NODE_ENV === "production" ? null : DEV_INGEST_SECRET);
}

export function isValidOperationLogIngestSecret(value: string | null) {
  const secret = resolveOperationLogIngestSecret();
  return Boolean(secret && value && value === secret);
}
