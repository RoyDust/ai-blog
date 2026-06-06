CREATE TYPE "NewsletterCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'PARTIAL_FAILED', 'FAILED');
CREATE TYPE "AiTopicStatus" AS ENUM ('NEW', 'WATCHING', 'PLANNED', 'DRAFTED', 'ARCHIVED');

CREATE TABLE "newsletter_campaigns" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "intro" TEXT,
  "postIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "NewsletterCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "newsletter_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "newsletter_deliveries" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "subscriberId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "newsletter_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_topics" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT,
  "angle" TEXT,
  "status" "AiTopicStatus" NOT NULL DEFAULT 'NEW',
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "heat" INTEGER NOT NULL DEFAULT 0,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "riskFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "firstSeenAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "postId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_topic_candidates" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "relevance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_topic_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "topic_guides" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "topic_guides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "topic_guide_posts" (
  "id" TEXT NOT NULL,
  "guideId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "topic_guide_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "newsletter_campaigns_status_createdAt_idx" ON "newsletter_campaigns" ("status", "createdAt");
CREATE INDEX "newsletter_campaigns_scheduledAt_idx" ON "newsletter_campaigns" ("scheduledAt");
CREATE UNIQUE INDEX "newsletter_deliveries_campaignId_subscriberId_key" ON "newsletter_deliveries" ("campaignId", "subscriberId");
CREATE INDEX "newsletter_deliveries_campaignId_status_idx" ON "newsletter_deliveries" ("campaignId", "status");
CREATE INDEX "newsletter_deliveries_subscriberId_idx" ON "newsletter_deliveries" ("subscriberId");

CREATE UNIQUE INDEX "ai_topics_slug_key" ON "ai_topics" ("slug");
CREATE INDEX "ai_topics_status_score_idx" ON "ai_topics" ("status", "score");
CREATE INDEX "ai_topics_lastSeenAt_idx" ON "ai_topics" ("lastSeenAt");
CREATE UNIQUE INDEX "ai_topic_candidates_topicId_candidateId_key" ON "ai_topic_candidates" ("topicId", "candidateId");
CREATE INDEX "ai_topic_candidates_candidateId_idx" ON "ai_topic_candidates" ("candidateId");

CREATE UNIQUE INDEX "topic_guides_slug_key" ON "topic_guides" ("slug");
CREATE INDEX "topic_guides_status_createdAt_idx" ON "topic_guides" ("status", "createdAt");
CREATE INDEX "topic_guides_deletedAt_idx" ON "topic_guides" ("deletedAt");
CREATE UNIQUE INDEX "topic_guide_posts_guideId_postId_key" ON "topic_guide_posts" ("guideId", "postId");
CREATE INDEX "topic_guide_posts_guideId_order_idx" ON "topic_guide_posts" ("guideId", "order");
CREATE INDEX "topic_guide_posts_postId_idx" ON "topic_guide_posts" ("postId");

ALTER TABLE "newsletter_deliveries"
ADD CONSTRAINT "newsletter_deliveries_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "newsletter_campaigns"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_topic_candidates"
ADD CONSTRAINT "ai_topic_candidates_topicId_fkey"
FOREIGN KEY ("topicId") REFERENCES "ai_topics"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topic_guide_posts"
ADD CONSTRAINT "topic_guide_posts_guideId_fkey"
FOREIGN KEY ("guideId") REFERENCES "topic_guides"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topic_guide_posts"
ADD CONSTRAINT "topic_guide_posts_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "posts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
