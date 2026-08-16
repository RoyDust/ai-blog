import { safeSecretEquals } from "@/lib/internal-secrets";

const DEV_INGEST_SECRET = "development-operation-log-ingest";

let warnedMissingProductionIngestSecret = false;

/**
 * 内部日志摄取密钥只从专用环境变量读取，不再回退到 AUTH_SECRET：
 * 会话签名密钥与内部接口密钥职责分离，轮换 AUTH_SECRET 不再波及日志摄取。
 * 生产环境未配置时返回 null，middleware 会跳过被拒日志回写而非降级复用，
 * 同时对缺失发出一次醒目的启动告警（fail-loud，避免审计日志静默丢失）。
 */
export function resolveOperationLogIngestSecret() {
  if (process.env.OPERATION_LOG_INGEST_SECRET) {
    return process.env.OPERATION_LOG_INGEST_SECRET;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_INGEST_SECRET;
  }

  if (!warnedMissingProductionIngestSecret) {
    warnedMissingProductionIngestSecret = true;
    console.error(
      "[security] OPERATION_LOG_INGEST_SECRET is not configured; denied admin API requests will NOT be recorded.",
    );
  }

  return null;
}

export function isValidOperationLogIngestSecret(value: string | null) {
  const secret = resolveOperationLogIngestSecret();
  return Boolean(secret && value && safeSecretEquals(value, secret));
}
