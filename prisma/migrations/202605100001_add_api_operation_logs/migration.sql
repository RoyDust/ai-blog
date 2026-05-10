CREATE TABLE "api_operation_logs" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "route" TEXT,
  "scope" TEXT NOT NULL,
  "operation" TEXT,
  "statusCode" INTEGER,
  "success" BOOLEAN NOT NULL,
  "durationMs" INTEGER,
  "actorType" TEXT,
  "actorUserId" TEXT,
  "actorClientId" TEXT,
  "actorLabel" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "query" JSONB,
  "requestBody" JSONB,
  "errorName" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_operation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_operation_logs_createdAt_idx" ON "api_operation_logs"("createdAt");
CREATE INDEX "api_operation_logs_requestId_idx" ON "api_operation_logs"("requestId");
CREATE INDEX "api_operation_logs_method_createdAt_idx" ON "api_operation_logs"("method", "createdAt");
CREATE INDEX "api_operation_logs_statusCode_createdAt_idx" ON "api_operation_logs"("statusCode", "createdAt");
CREATE INDEX "api_operation_logs_success_createdAt_idx" ON "api_operation_logs"("success", "createdAt");
CREATE INDEX "api_operation_logs_path_createdAt_idx" ON "api_operation_logs"("path", "createdAt");
CREATE INDEX "api_operation_logs_actorUserId_createdAt_idx" ON "api_operation_logs"("actorUserId", "createdAt");

ALTER TABLE "api_operation_logs"
ADD CONSTRAINT "api_operation_logs_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
