-- Nullable markers preserve legacy history. Existing deliveries are not backfilled.
ALTER TABLE "newsletter_campaigns" ADD COLUMN "audienceFrozenAt" TIMESTAMP(3);
ALTER TABLE "newsletter_deliveries"
  ADD COLUMN "attemptId" TEXT,
  ADD COLUMN "attemptStartedAt" TIMESTAMP(3),
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerReceiptId" TEXT,
  ADD COLUMN "evidenceReference" TEXT,
  ADD COLUMN "simulated" BOOLEAN;
CREATE TABLE "newsletter_delivery_reconciliations" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceKind" TEXT,
  "evidenceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "newsletter_delivery_reconciliations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "newsletter_delivery_reconciliations_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "newsletter_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "newsletter_delivery_reconciliations_deliveryId_attemptId_key" ON "newsletter_delivery_reconciliations"("deliveryId", "attemptId");
