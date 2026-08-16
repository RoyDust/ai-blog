import { createHash, timingSafeEqual } from "node:crypto";

import { ApiError, UnauthorizedError } from "@/lib/api-errors";

/**
 * cron / internal 接口共享的密钥校验工具。
 *
 * 设计目标：
 * - 常量时间比较：先对双方做 SHA-256 摘要再 timingSafeEqual，
 *   既避免时序侧信道，也兼容任意长度的输入；
 * - 统一 Bearer token 解析，替换各 route 里重复的手写正则；
 * - 弱密钥识别：帮助运维尽早发现占位符/过短密钥；
 * - 统一"密钥解析 + 校验"入口：所有内部接口都必须经由
 *   requireInternalSecret / isValidInternalSecret 校验，
 *   生产缺配时 fail-fast（503），与"密钥错误"（401）明确区分。
 */

/**
 * 常量时间比较两个 secret。任一为空直接返回 false。
 */
export function safeSecretEquals(provided: string | null | undefined, expected: string | null | undefined) {
  if (!provided || !expected) {
    return false;
  }

  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * 从 Authorization 头解析 Bearer token；缺失或格式错误返回 null。
 */
export function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
}

const WEAK_SECRET_PATTERN =
  /placeholder|changeme|change-me|replace-with|your[-_]?secret|example|test[-_]?secret|^secret$/i;

/**
 * 识别明显偏弱的密钥（占位符样式或长度不足），用于启动期/请求期告警。
 */
export function isWeakSecret(value: string | null | undefined) {
  if (!value) {
    return true;
  }

  return value.length < 16 || WEAK_SECRET_PATTERN.test(value);
}

/**
 * 生产环境下对偏弱密钥发出一次醒目的告警（不阻断运行，
 * 避免在密钥轮换完成前打挂线上 cron）。
 */
export function warnOnWeakSecret(secretName: string, value: string | null | undefined) {
  if (process.env.NODE_ENV === "production" && isWeakSecret(value)) {
    console.warn(
      `[security] ${secretName} looks weak or placeholder-like; rotate it to a strong random value.`,
    );
  }
}

export const INTERNAL_SECRET_NOT_CONFIGURED_MESSAGE = "Internal service secret is not configured";

/**
 * 按顺序取第一个非空环境变量作为内部接口密钥；全部缺失返回 null。
 */
export function resolveInternalSecret(envKeys: string[]): string | null {
  for (const key of envKeys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export type InternalSecretRequirement = {
  /** 告警与日志中使用的密钥名称 */
  secretName: string;
  /** 环境变量回退链，按顺序取第一个非空值 */
  envKeys: string[];
  /** 提取密钥的请求头；缺省为 Authorization: Bearer */
  header?: string;
};

/**
 * 内部接口统一守卫：
 * - 密钥缺失（任意环境）→ 抛 503（fail-fast，不泄露配置名）；
 * - 弱密钥 → 生产告警（不阻断）；
 * - 密钥不匹配 → 抛 401。
 */
export function requireInternalSecret(request: Request, options: InternalSecretRequirement): void {
  const configuredSecret = resolveInternalSecret(options.envKeys);
  if (!configuredSecret) {
    throw new ApiError(503, INTERNAL_SECRET_NOT_CONFIGURED_MESSAGE);
  }

  warnOnWeakSecret(options.secretName, configuredSecret);

  const provided = options.header
    ? (request.headers.get(options.header) ?? "").trim() || null
    : readBearerToken(request);

  if (!safeSecretEquals(provided, configuredSecret)) {
    throw new UnauthorizedError();
  }
}

/**
 * 布尔判定形态的内部密钥校验（供"是/否"分支的路由使用）。
 * 密钥缺失时返回 false，由调用方决定 503 语义。
 */
export function isValidInternalSecret(provided: string | null | undefined, envKeys: string[]): boolean {
  const configuredSecret = resolveInternalSecret(envKeys);

  return safeSecretEquals(provided, configuredSecret);
}
