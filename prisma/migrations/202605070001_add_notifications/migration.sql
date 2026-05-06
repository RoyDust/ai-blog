CREATE TYPE "NotificationType" AS ENUM (
  'COMMENT_CREATED',
  'COMMENT_PENDING',
  'COMMENT_REPLY',
  'AI_TASK_SUCCEEDED',
  'AI_TASK_FAILED',
  'AI_TASK_PARTIAL_FAILED',
  'AI_NEWS_SUCCEEDED',
  'AI_NEWS_FAILED',
  'SYSTEM_WARNING'
);

CREATE TYPE "NotificationSeverity" AS ENUM (
  'INFO',
  'SUCCESS',
  'WARNING',
  'ERROR'
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "actionUrl" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "dedupeKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_recipients" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");
CREATE INDEX "notifications_type_createdAt_idx" ON "notifications"("type", "createdAt");
CREATE INDEX "notifications_severity_createdAt_idx" ON "notifications"("severity", "createdAt");
CREATE INDEX "notifications_entityType_entityId_idx" ON "notifications"("entityType", "entityId");

CREATE UNIQUE INDEX "notification_recipients_notificationId_userId_key" ON "notification_recipients"("notificationId", "userId");
CREATE INDEX "notification_recipients_userId_readAt_createdAt_idx" ON "notification_recipients"("userId", "readAt", "createdAt");
CREATE INDEX "notification_recipients_userId_dismissedAt_createdAt_idx" ON "notification_recipients"("userId", "dismissedAt", "createdAt");

ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
