CREATE TABLE "ai_api_clients" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "ownerId" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_api_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_draft_bindings" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_draft_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_api_clients_tokenPrefix_key" ON "ai_api_clients"("tokenPrefix");
CREATE UNIQUE INDEX "ai_api_clients_tokenHash_key" ON "ai_api_clients"("tokenHash");
CREATE INDEX "ai_api_clients_ownerId_idx" ON "ai_api_clients"("ownerId");
CREATE INDEX "ai_api_clients_revokedAt_idx" ON "ai_api_clients"("revokedAt");

CREATE UNIQUE INDEX "ai_draft_bindings_postId_key" ON "ai_draft_bindings"("postId");
CREATE UNIQUE INDEX "ai_draft_bindings_clientId_externalId_key" ON "ai_draft_bindings"("clientId", "externalId");
CREATE INDEX "ai_draft_bindings_clientId_idx" ON "ai_draft_bindings"("clientId");

ALTER TABLE "ai_api_clients"
  ADD CONSTRAINT "ai_api_clients_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_draft_bindings"
  ADD CONSTRAINT "ai_draft_bindings_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "ai_api_clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_draft_bindings"
  ADD CONSTRAINT "ai_draft_bindings_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "posts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
