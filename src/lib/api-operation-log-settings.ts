import { ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

const LOG_STORAGE_SETTING_KEY = "apiOperationLog.maxStorageBytes";

export const DEFAULT_API_OPERATION_LOG_MAX_STORAGE_BYTES = 10 * 1024 * 1024;
export const MIN_API_OPERATION_LOG_MAX_STORAGE_BYTES = 1 * 1024 * 1024;
export const MAX_API_OPERATION_LOG_MAX_STORAGE_BYTES = 512 * 1024 * 1024;

type RawPrisma = typeof prisma & {
  $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  $executeRawUnsafe?: (query: string, ...values: unknown[]) => Promise<number>;
};

type SettingRow = {
  value: unknown;
};

type StorageStatsRow = {
  bytes: bigint | number | string | null;
  rowCount: bigint | number | string | null;
};

function isMissingRelationError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return code === "42P01" || code === "P2021" || message.includes("relation \"system_settings\" does not exist");
}

function rawPrisma() {
  return prisma as RawPrisma;
}

function toNumber(value: bigint | number | string | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

function coerceStoredSetting(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readStoredMaxStorageBytes(value: unknown) {
  const setting = coerceStoredSetting(value);

  if (typeof setting === "number") {
    return setting;
  }

  if (typeof setting === "string") {
    return parseApiOperationLogMaxStorageBytes(setting);
  }

  if (typeof setting === "object" && setting !== null) {
    const record = setting as Record<string, unknown>;
    const candidate = record.maxStorageBytes ?? record.bytes;
    return typeof candidate === "number" ? candidate : typeof candidate === "string" ? Number(candidate) : NaN;
  }

  return NaN;
}

export function bytesToMegabytes(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${bytesToMegabytes(bytes)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round((bytes / 1024) * 100) / 100} KB`;
  }

  return `${bytes} B`;
}

export function parseApiOperationLogMaxStorageBytes(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return NaN;
  }

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(b|kb|k|mb|m|mib|gb|g)?$/);
  if (!match) {
    return NaN;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "mb";
  const multiplier =
    unit === "gb" || unit === "g"
      ? 1024 * 1024 * 1024
      : unit === "kb" || unit === "k"
        ? 1024
        : unit === "b"
          ? 1
          : 1024 * 1024;

  return Math.round(amount * multiplier);
}

export function normalizeApiOperationLogMaxStorageBytes(value: unknown) {
  const bytes = typeof value === "string" ? parseApiOperationLogMaxStorageBytes(value) : Number(value);

  if (!Number.isFinite(bytes)) {
    throw new ValidationError("Invalid log storage limit");
  }

  const rounded = Math.round(bytes);
  if (rounded < MIN_API_OPERATION_LOG_MAX_STORAGE_BYTES || rounded > MAX_API_OPERATION_LOG_MAX_STORAGE_BYTES) {
    throw new ValidationError("Log storage limit must be between 1 MB and 512 MB");
  }

  return rounded;
}

export async function getApiOperationLogMaxStorageBytes() {
  const client = rawPrisma();
  if (!client.$queryRawUnsafe) {
    return DEFAULT_API_OPERATION_LOG_MAX_STORAGE_BYTES;
  }

  const rows = await client
    .$queryRawUnsafe<SettingRow[]>(
      'SELECT "value" FROM "system_settings" WHERE "key" = $1 LIMIT 1',
      LOG_STORAGE_SETTING_KEY,
    )
    .catch((error) => {
      if (isMissingRelationError(error)) {
        return [];
      }

      throw error;
    });
  const storedBytes = rows[0] ? readStoredMaxStorageBytes(rows[0].value) : NaN;

  if (!Number.isFinite(storedBytes)) {
    return DEFAULT_API_OPERATION_LOG_MAX_STORAGE_BYTES;
  }

  try {
    return normalizeApiOperationLogMaxStorageBytes(storedBytes);
  } catch {
    return DEFAULT_API_OPERATION_LOG_MAX_STORAGE_BYTES;
  }
}

export async function getApiOperationLogStorageStats() {
  const client = rawPrisma();
  if (!client.$queryRawUnsafe) {
    return { bytes: 0, rowCount: 0 };
  }

  const rows = await client.$queryRawUnsafe<StorageStatsRow[]>(`
    SELECT
      COALESCE(SUM(pg_column_size(logs.*)), 0)::bigint AS "bytes",
      COUNT(*)::bigint AS "rowCount"
    FROM "api_operation_logs" AS logs
  `);
  const row = rows[0];

  return {
    bytes: toNumber(row?.bytes),
    rowCount: toNumber(row?.rowCount),
  };
}

export async function enforceApiOperationLogStorageLimit(maxStorageBytes?: number) {
  const client = rawPrisma();
  if (!client.$executeRawUnsafe) {
    return { deletedCount: 0 };
  }

  const limit = normalizeApiOperationLogMaxStorageBytes(maxStorageBytes ?? (await getApiOperationLogMaxStorageBytes()));
  const deletedCount = await client.$executeRawUnsafe(
    `
      WITH sized AS (
        SELECT
          "id",
          pg_column_size(logs.*)::bigint AS row_size,
          "createdAt"
        FROM "api_operation_logs" AS logs
      ),
      ranked AS (
        SELECT
          "id",
          SUM(row_size) OVER (ORDER BY "createdAt" DESC, "id" DESC) AS newest_bytes
        FROM sized
      )
      DELETE FROM "api_operation_logs"
      WHERE "id" IN (
        SELECT "id"
        FROM ranked
        WHERE newest_bytes > $1
      )
    `,
    limit,
  );

  return { deletedCount };
}

export async function updateApiOperationLogMaxStorageBytes(value: unknown) {
  const maxStorageBytes = normalizeApiOperationLogMaxStorageBytes(value);
  const client = rawPrisma();

  if (!client.$executeRawUnsafe) {
    return { maxStorageBytes, deletedCount: 0 };
  }

  await client.$executeRawUnsafe(
    `
      INSERT INTO "system_settings" ("key", "value", "updatedAt")
      VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT ("key")
      DO UPDATE SET "value" = $2::jsonb, "updatedAt" = CURRENT_TIMESTAMP
    `,
    LOG_STORAGE_SETTING_KEY,
    JSON.stringify({ maxStorageBytes }),
  );

  const { deletedCount } = await enforceApiOperationLogStorageLimit(maxStorageBytes);
  return { maxStorageBytes, deletedCount };
}

export async function getApiOperationLogSettingsSummary() {
  const [maxStorageBytes, storage] = await Promise.all([
    getApiOperationLogMaxStorageBytes(),
    getApiOperationLogStorageStats(),
  ]);

  return {
    maxStorageBytes,
    maxStorageMb: bytesToMegabytes(maxStorageBytes),
    currentStorageBytes: storage.bytes,
    currentStorageLabel: formatBytes(storage.bytes),
    rowCount: storage.rowCount,
  };
}
