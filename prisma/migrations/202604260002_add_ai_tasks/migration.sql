ALTER TABLE "posts"
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "seoDescription" TEXT,
ADD COLUMN "seoGeneratedAt" TIMESTAMP(3),
ADD COLUMN "seoModelId" TEXT;

CREATE TABLE "ai_tasks" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "modelId" TEXT,
    "createdById" TEXT,
    "requestedCount" INTEGER NOT NULL DEFAULT 0,
    "succeededCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_task_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "postId" TEXT,
    "status" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "inputSnapshot" JSONB,
    "output" JSONB,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_task_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "posts_seoGeneratedAt_idx" ON "posts"("seoGeneratedAt");
CREATE INDEX "ai_tasks_status_createdAt_idx" ON "ai_tasks"("status", "createdAt");
CREATE INDEX "ai_tasks_type_createdAt_idx" ON "ai_tasks"("type", "createdAt");
CREATE INDEX "ai_tasks_createdById_idx" ON "ai_tasks"("createdById");
CREATE INDEX "ai_task_items_taskId_status_idx" ON "ai_task_items"("taskId", "status");
CREATE INDEX "ai_task_items_postId_idx" ON "ai_task_items"("postId");
CREATE INDEX "ai_task_items_action_createdAt_idx" ON "ai_task_items"("action", "createdAt");

ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_task_items" ADD CONSTRAINT "ai_task_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_task_items" ADD CONSTRAINT "ai_task_items_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
