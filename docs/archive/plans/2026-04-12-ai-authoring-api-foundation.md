# AI Authoring API Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a phase-1 machine-facing authoring surface that lets Codex or other AI clients read the blog contract and upsert Markdown drafts through documented HTTP endpoints without reusing the browser admin session flow.

**Architecture:** Add a dedicated bearer-token auth path for machine clients, a small draft binding table that makes writes idempotent per client `externalId`, and route handlers under `/api/ai` that call shared authoring services instead of duplicating Prisma logic inside route files. Publish the contract through a live metadata endpoint, an OpenAPI document, and `/llms.txt`, while keeping review workflow and remote MCP out of this phase.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Prisma 7, PostgreSQL, Vitest, Markdown docs

---

## Scope Notes

- This plan covers only phase 1: machine auth, AI draft APIs, and machine-readable docs.
- Keep `/api/admin/*` as the human backoffice surface. Do not let AI clients share session-cookie auth.
- AI writes must always end in `published=false`.
- AI draft writes must be idempotent per machine client and `externalId`.
- Remote MCP tooling is a separate follow-up plan once the HTTP contract is stable.

## Acceptance Criteria

- Database schema supports revocable AI API clients and a unique draft binding from `{clientId, externalId}` to a single `Post`.
- `GET /api/ai/meta` returns authoring limits plus live category and tag slugs.
- `POST /api/ai/drafts` creates or updates a draft by `externalId` and never publishes it.
- `GET /api/ai/drafts/[externalId]` returns the stored normalized draft for the authenticated client.
- `GET /api/ai/openapi` and `GET /llms.txt` expose the same contract and authentication model.
- Admin post APIs continue to work after the shared service extraction.
- Targeted Vitest suites, `pnpm lint`, and `pnpm build` pass.

## File Structure

- `prisma/schema.prisma`
  Add `AiApiClient` and `AiDraftBinding` models plus the relation fields on `User` and `Post`.
- `prisma/migrations/202604120001_add_ai_authoring_clients/migration.sql`
  Create the new tables and indexes for token lookup and idempotent draft binding.
- `scripts/create-ai-api-token.mjs`
  One-shot operator script that creates a hashed bearer token bound to an owner user.
- `src/lib/ai-auth.ts`
  Bearer token parsing, hashing, scope checking, and `lastUsedAt` tracking.
- `src/lib/ai-contract.ts`
  Shared AI authoring constants, limits, scope names, and docs metadata.
- `src/lib/ai-authoring.ts`
  Shared draft upsert and read services with taxonomy resolution and reading-time recalculation.
- `src/lib/validation.ts`
  AI request-body parsing that reuses the existing string and slug validators.
- `src/app/api/ai/meta/route.ts`
  Live taxonomy and authoring metadata endpoint.
- `src/app/api/ai/drafts/route.ts`
  Idempotent draft upsert endpoint.
- `src/app/api/ai/drafts/[externalId]/route.ts`
  Draft readback endpoint scoped to the calling AI client.
- `src/app/api/ai/openapi/route.ts`
  Public OpenAPI document for the AI contract.
- `src/app/llms.txt/route.ts`
  Plain-text discovery document that points agents to the contract and examples.
- `docs/integrations/ai-authoring-api.md`
  Operator-facing setup guide with sample requests.
- `src/lib/__tests__/ai-auth.test.ts`
  Unit tests for token auth and scope enforcement.
- `src/lib/__tests__/ai-authoring.test.ts`
  Unit tests for idempotent draft upsert behavior.
- `src/app/api/ai/meta/__tests__/route.test.ts`
  Route tests for live metadata output.
- `src/app/api/ai/drafts/__tests__/route.test.ts`
  Route tests for create/update draft behavior.
- `src/app/api/ai/drafts/[externalId]/__tests__/route.test.ts`
  Route tests for draft readback.
- `src/app/api/ai/openapi/__tests__/route.test.ts`
  Route tests for the OpenAPI response.
- `src/app/llms.txt/__tests__/route.test.ts`
  Route tests for the discovery document.

## Task Order

1. Add machine auth primitives and persistent draft binding.
2. Build the shared draft service and refactor admin writes onto it.
3. Add AI routes on top of the shared service.
4. Publish the machine-readable documentation surfaces.
5. Run final verification and smoke the token bootstrap flow.

---

### Task 1: Add AI API clients and bearer auth primitives

**Files:**
- Create: `prisma/migrations/202604120001_add_ai_authoring_clients/migration.sql`
- Create: `scripts/create-ai-api-token.mjs`
- Create: `src/lib/ai-auth.ts`
- Create: `src/lib/__tests__/ai-auth.test.ts`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the failing AI auth tests**

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiApiClient: {
      findFirst,
      update,
    },
  },
}));

describe("ai auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("accepts a bearer token with the required scope", async () => {
    findFirst.mockResolvedValueOnce({
      id: "client-1",
      ownerId: "user-1",
      name: "Codex",
      scopes: ["drafts:write", "drafts:read", "taxonomy:read"],
    });

    const { hashAiToken, requireAiClient } = await import("../ai-auth");
    const request = new Request("http://localhost/api/ai/drafts", {
      headers: {
        Authorization: "Bearer blog_ai_token_123",
      },
    });

    const client = await requireAiClient(request, "drafts:write");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: hashAiToken("blog_ai_token_123"),
        revokedAt: null,
      },
      select: {
        id: true,
        ownerId: true,
        name: true,
        scopes: true,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(client).toEqual({
      id: "client-1",
      ownerId: "user-1",
      name: "Codex",
      scopes: ["drafts:write", "drafts:read", "taxonomy:read"],
    });
  });

  test("rejects a valid token without the requested scope", async () => {
    findFirst.mockResolvedValueOnce({
      id: "client-1",
      ownerId: "user-1",
      name: "Codex",
      scopes: ["taxonomy:read"],
    });

    const { requireAiClient } = await import("../ai-auth");
    const request = new Request("http://localhost/api/ai/drafts", {
      headers: {
        Authorization: "Bearer blog_ai_token_123",
      },
    });

    await expect(requireAiClient(request, "drafts:write")).rejects.toMatchObject({
      status: 403,
      message: "Missing AI scope: drafts:write",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/ai-auth.test.ts`

Expected: FAIL because `src/lib/ai-auth.ts` does not exist yet and Prisma does not have an `aiApiClient` model.

- [ ] **Step 3: Add the Prisma schema and migration**

Update `prisma/schema.prisma` with these additions:

```prisma
model User {
  id            String        @id @default(cuid())
  name          String?
  email         String        @unique
  emailVerified DateTime?
  image         String?
  password      String?
  role          Role          @default(USER)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  posts         Post[]
  comments      Comment[]
  likes         Like[]
  bookmarks     Bookmark[]
  accounts      Account[]
  sessions      Session[]
  aiApiClients  AiApiClient[]

  @@map("users")
}

model Post {
  id                 String          @id @default(cuid())
  title              String
  slug               String          @unique
  content            String          @db.Text
  excerpt            String?
  coverImage         String?
  published          Boolean         @default(false)
  viewCount          Int             @default(0)
  readingTimeMinutes Int             @default(1)
  deletedAt          DateTime?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  publishedAt        DateTime?

  authorId           String
  author             User            @relation(fields: [authorId], references: [id], onDelete: Cascade)
  categoryId         String?
  category           Category?       @relation(fields: [categoryId], references: [id])
  tags               Tag[]
  comments           Comment[]
  likes              Like[]
  bookmarks          Bookmark[]
  aiDraftBinding     AiDraftBinding?

  @@index([authorId])
  @@index([categoryId])
  @@index([published, createdAt])
  @@index([deletedAt])
  @@map("posts")
}

model AiApiClient {
  id          String    @id @default(cuid())
  name        String
  tokenPrefix String    @unique
  tokenHash   String    @unique
  scopes      String[]
  ownerId     String
  owner       User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  drafts      AiDraftBinding[]

  @@index([ownerId])
  @@index([revokedAt])
  @@map("ai_api_clients")
}

model AiDraftBinding {
  id         String      @id @default(cuid())
  clientId   String
  client     AiApiClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  postId     String      @unique
  post       Post        @relation(fields: [postId], references: [id], onDelete: Cascade)
  externalId String
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  @@unique([clientId, externalId])
  @@index([clientId])
  @@map("ai_draft_bindings")
}
```

Create `prisma/migrations/202604120001_add_ai_authoring_clients/migration.sql`:

```sql
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
```

- [ ] **Step 4: Implement bearer auth and token bootstrap**

Create `src/lib/ai-auth.ts`:

```ts
import { createHash } from "node:crypto";

import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

export const AI_SCOPES = ["drafts:read", "drafts:write", "taxonomy:read"] as const;
export type AiScope = (typeof AI_SCOPES)[number];

export interface AiClientSession {
  id: string;
  ownerId: string;
  name: string;
  scopes: string[];
}

export function hashAiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing AI bearer token");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new UnauthorizedError("Missing AI bearer token");
  }

  return token;
}

export async function requireAiClient(request: Request, scope: AiScope): Promise<AiClientSession> {
  const token = readBearerToken(request);
  const client = await prisma.aiApiClient.findFirst({
    where: {
      tokenHash: hashAiToken(token),
      revokedAt: null,
    },
    select: {
      id: true,
      ownerId: true,
      name: true,
      scopes: true,
    },
  });

  if (!client) {
    throw new UnauthorizedError("Invalid AI API token");
  }

  if (!client.scopes.includes(scope)) {
    throw new ForbiddenError(`Missing AI scope: ${scope}`);
  }

  await prisma.aiApiClient.update({
    where: { id: client.id },
    data: { lastUsedAt: new Date() },
  });

  return client;
}
```

Create `scripts/create-ai-api-token.mjs`:

```js
#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

function readFlag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readFlags(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
    }
  }
  return values;
}

function hashAiToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

const prisma = new PrismaClient();

async function main() {
  const name = readFlag("--name");
  const ownerEmail = readFlag("--owner-email");
  const scopes = readFlags("--scope");

  if (!name || !ownerEmail || scopes.length === 0) {
    throw new Error("Usage: node --env-file=.env scripts/create-ai-api-token.mjs --name <name> --owner-email <email> --scope drafts:read --scope drafts:write");
  }

  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, email: true },
  });

  if (!owner) {
    throw new Error(`Owner not found for email: ${ownerEmail}`);
  }

  const token = `blog_ai_${randomBytes(24).toString("hex")}`;
  await prisma.aiApiClient.create({
    data: {
      name,
      ownerId: owner.id,
      tokenPrefix: token.slice(0, 16),
      tokenHash: hashAiToken(token),
      scopes,
    },
  });

  console.log(JSON.stringify({
    name,
    ownerEmail: owner.email,
    scopes,
    token,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 5: Regenerate Prisma client and rerun the auth test**

Run: `pnpm prisma generate`

Expected: PASS with the Prisma client reflecting `AiApiClient` and `AiDraftBinding`.

Run: `pnpm exec vitest run src/lib/__tests__/ai-auth.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/202604120001_add_ai_authoring_clients/migration.sql scripts/create-ai-api-token.mjs src/lib/ai-auth.ts src/lib/__tests__/ai-auth.test.ts
git commit -m "feat(ai): add bearer auth primitives for ai authoring"
```

---

### Task 2: Build the shared AI draft service and move admin writes onto it

**Files:**
- Create: `src/lib/ai-contract.ts`
- Create: `src/lib/ai-authoring.ts`
- Create: `src/lib/__tests__/ai-authoring.test.ts`
- Modify: `src/lib/validation.ts`
- Modify: `src/app/api/admin/posts/route.ts`
- Modify: `src/app/api/admin/posts/[id]/route.ts`
- Review: `src/lib/reading-time.ts`
- Review: `src/lib/slug.ts`

- [ ] **Step 1: Write the failing draft-service test**

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirstCategory = vi.fn();
const findManyTags = vi.fn();
const findUniqueBinding = vi.fn();
const createBinding = vi.fn();
const createPost = vi.fn();
const updatePost = vi.fn();
const calculateReadingTimeMinutes = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findFirst: findFirstCategory,
    },
    tag: {
      findMany: findManyTags,
    },
    aiDraftBinding: {
      findUnique: findUniqueBinding,
      create: createBinding,
    },
    post: {
      create: createPost,
      update: updatePost,
    },
  },
}));

vi.mock("@/lib/reading-time", () => ({
  calculateReadingTimeMinutes,
}));

describe("ai authoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates a new unpublished draft for a fresh external id", async () => {
    findFirstCategory.mockResolvedValueOnce({ id: "cat-1", slug: "engineering" });
    findManyTags.mockResolvedValueOnce([{ id: "tag-1", slug: "nextjs" }]);
    findUniqueBinding.mockResolvedValueOnce(null);
    calculateReadingTimeMinutes.mockReturnValueOnce(4);
    createPost.mockResolvedValueOnce({
      id: "post-1",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      excerpt: "summary",
      coverImage: null,
      readingTimeMinutes: 4,
      published: false,
      category: { slug: "engineering" },
      tags: [{ slug: "nextjs" }],
    });
    createBinding.mockResolvedValueOnce({});

    const { upsertAiDraft } = await import("../ai-authoring");
    const result = await upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-001",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
        excerpt: "summary",
        categorySlug: "engineering",
        tagSlugs: ["nextjs"],
      },
    });

    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        authorId: "user-1",
        published: false,
        publishedAt: null,
        readingTimeMinutes: 4,
        categoryId: "cat-1",
      }),
    }));
    expect(result.operation).toBe("created");
    expect(result.draft.externalId).toBe("draft-001");
  });

  test("updates the existing draft when the client reuses external id", async () => {
    findFirstCategory.mockResolvedValueOnce(null);
    findManyTags.mockResolvedValueOnce([]);
    findUniqueBinding.mockResolvedValueOnce({
      clientId: "client-1",
      externalId: "draft-001",
      postId: "post-1",
    });
    calculateReadingTimeMinutes.mockReturnValueOnce(6);
    updatePost.mockResolvedValueOnce({
      id: "post-1",
      title: "Updated",
      slug: "updated",
      content: "# Updated",
      excerpt: null,
      coverImage: null,
      readingTimeMinutes: 6,
      published: false,
      category: null,
      tags: [],
    });

    const { upsertAiDraft } = await import("../ai-authoring");
    const result = await upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-001",
        title: "Updated",
        slug: "updated",
        content: "# Updated",
      },
    });

    expect(updatePost).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post-1" },
      data: expect.objectContaining({
        published: false,
        publishedAt: null,
      }),
    }));
    expect(result.operation).toBe("updated");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/ai-authoring.test.ts`

Expected: FAIL because `src/lib/ai-authoring.ts` and `src/lib/ai-contract.ts` do not exist yet.

- [ ] **Step 3: Add shared AI contract constants and validation**

Create `src/lib/ai-contract.ts`:

```ts
export const AI_AUTHORING_VERSION = "2026-04-12";

export const AI_AUTHORING_LIMITS = {
  excerptMaxLength: 320,
  titleMaxLength: 160,
  supportsMarkdown: true,
  publishRequiresHumanReview: true,
} as const;

export const AI_AUTHORING_ENDPOINTS = {
  meta: "/api/ai/meta",
  drafts: "/api/ai/drafts",
  openapi: "/api/ai/openapi",
  llms: "/llms.txt",
} as const;
```

Add this parser to `src/lib/validation.ts`:

```ts
export function parseAiDraftInput(payload: unknown) {
  const data = (payload ?? {}) as {
    externalId?: unknown
    title?: unknown
    slug?: unknown
    content?: unknown
    excerpt?: unknown
    coverImage?: unknown
    categorySlug?: unknown
    tagSlugs?: unknown
  }

  const title = readString(data.title, "title")
  const slug = readString(data.slug, "slug")
  const content = readString(data.content, "content")
  const excerpt = optionalString(data.excerpt, "excerpt")

  assertLength(title, "title", MAX_POST_TITLE_LENGTH)
  assertLength(excerpt, "excerpt", MAX_EXCERPT_LENGTH)
  assertSlug(slug, "slug")

  return {
    externalId: readString(data.externalId, "externalId"),
    title,
    slug,
    content,
    excerpt,
    coverImage: optionalString(data.coverImage, "coverImage"),
    categorySlug: optionalString(data.categorySlug, "categorySlug"),
    tagSlugs: normalizeStringArray(data.tagSlugs, "tagSlugs") ?? [],
  }
}
```

- [ ] **Step 4: Implement the shared draft service**

Create `src/lib/ai-authoring.ts`:

```ts
import { NotFoundError, ValidationError } from "@/lib/api-errors";
import type { AiClientSession } from "@/lib/ai-auth";
import { prisma } from "@/lib/prisma";
import { calculateReadingTimeMinutes } from "@/lib/reading-time";

export interface AiDraftInput {
  externalId: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  categorySlug?: string;
  tagSlugs: string[];
}

function normalizeDraft(post: {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  readingTimeMinutes: number;
  published: boolean;
  category: { slug: string } | null;
  tags: Array<{ slug: string }>;
}, externalId: string) {
  return {
    id: post.id,
    externalId,
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    readingTimeMinutes: post.readingTimeMinutes,
    published: post.published,
    categorySlug: post.category?.slug ?? null,
    tagSlugs: post.tags.map((tag) => tag.slug),
  };
}

async function resolveCategoryId(categorySlug?: string) {
  if (!categorySlug) {
    return null;
  }

  const category = await prisma.category.findFirst({
    where: { slug: categorySlug, deletedAt: null },
    select: { id: true, slug: true },
  });

  if (!category) {
    throw new ValidationError(`Unknown category slug: ${categorySlug}`);
  }

  return category.id;
}

async function resolveTagIds(tagSlugs: string[]) {
  if (tagSlugs.length === 0) {
    return [];
  }

  const tags = await prisma.tag.findMany({
    where: { slug: { in: tagSlugs }, deletedAt: null },
    select: { id: true, slug: true },
  });

  if (tags.length !== new Set(tagSlugs).size) {
    const found = new Set(tags.map((tag) => tag.slug));
    const missing = tagSlugs.filter((slug) => !found.has(slug));
    throw new ValidationError(`Unknown tag slug: ${missing.join(",")}`);
  }

  return tags.map((tag) => tag.id);
}

export async function upsertAiDraft({
  client,
  input,
}: {
  client: AiClientSession;
  input: AiDraftInput;
}) {
  const [categoryId, tagIds, binding] = await Promise.all([
    resolveCategoryId(input.categorySlug),
    resolveTagIds(input.tagSlugs),
    prisma.aiDraftBinding.findUnique({
      where: {
        clientId_externalId: {
          clientId: client.id,
          externalId: input.externalId,
        },
      },
      select: {
        clientId: true,
        externalId: true,
        postId: true,
      },
    }),
  ]);

  const data = {
    title: input.title,
    slug: input.slug,
    content: input.content,
    excerpt: input.excerpt,
    coverImage: input.coverImage,
    categoryId,
    readingTimeMinutes: calculateReadingTimeMinutes(input.content),
    published: false,
    publishedAt: null,
  };

  if (binding) {
    const post = await prisma.post.update({
      where: { id: binding.postId },
      data: {
        ...data,
        tags: {
          set: tagIds.map((id) => ({ id })),
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        coverImage: true,
        readingTimeMinutes: true,
        published: true,
        category: { select: { slug: true } },
        tags: { where: { deletedAt: null }, select: { slug: true } },
      },
    });

    return {
      operation: "updated" as const,
      draft: normalizeDraft(post, binding.externalId),
    };
  }

  const post = await prisma.post.create({
    data: {
      ...data,
      authorId: client.ownerId,
      tags: {
        connect: tagIds.map((id) => ({ id })),
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
      coverImage: true,
      readingTimeMinutes: true,
      published: true,
      category: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  });

  await prisma.aiDraftBinding.create({
    data: {
      clientId: client.id,
      postId: post.id,
      externalId: input.externalId,
    },
  });

  return {
    operation: "created" as const,
    draft: normalizeDraft(post, input.externalId),
  };
}

export async function getAiDraft(clientId: string, externalId: string) {
  const binding = await prisma.aiDraftBinding.findUnique({
    where: {
      clientId_externalId: {
        clientId,
        externalId,
      },
    },
    select: {
      externalId: true,
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          excerpt: true,
          coverImage: true,
          readingTimeMinutes: true,
          published: true,
          category: { select: { slug: true } },
          tags: { where: { deletedAt: null }, select: { slug: true } },
        },
      },
    },
  });

  if (!binding) {
    throw new NotFoundError("AI draft not found");
  }

  return normalizeDraft(binding.post, binding.externalId);
}
```

Refactor `src/app/api/admin/posts/route.ts` create path to call a small shared helper instead of inlining the write. The core replacement is:

```ts
import { createAdminPost } from "@/lib/ai-authoring";

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const input = parsePostInput(await request.json());
    const post = await createAdminPost({
      authorId: session.user.id,
      input,
    });

    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    console.error("Create admin post error:", error);
    return toErrorResponse(error);
  }
}
```

Refactor `src/app/api/admin/posts/[id]/route.ts` update path in the same style:

```ts
import { updateAdminPost } from "@/lib/ai-authoring";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const input = parsePostPatchInput(await request.json());
    const updated = await updateAdminPost({
      id,
      input,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

Inside `src/lib/ai-authoring.ts`, add these admin helpers below the AI functions so admin and AI writes share taxonomy and revalidation rules:

```ts
import { revalidatePublicContent } from "@/lib/cache";
import { parsePostInput, parsePostPatchInput } from "@/lib/validation";

type AdminCreateInput = ReturnType<typeof parsePostInput>;
type AdminPatchInput = ReturnType<typeof parsePostPatchInput>;

export async function createAdminPost({ authorId, input }: { authorId: string; input: AdminCreateInput }) {
  const post = await prisma.post.create({
    data: {
      ...input,
      authorId,
      publishedAt: input.published ? new Date() : null,
      readingTimeMinutes: calculateReadingTimeMinutes(input.content),
      tags: input.tagIds ? { connect: input.tagIds.map((id) => ({ id })) } : undefined,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      category: true,
      tags: true,
    },
  });

  if (post.published) {
    revalidatePublicContent({
      slug: post.slug,
      categorySlug: post.category?.slug,
      tagSlugs: post.tags.map((tag) => tag.slug),
    });
  }

  return post;
}

export async function updateAdminPost({ id, input }: { id: string; input: AdminPatchInput }) {
  const existing = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: {
      slug: true,
      category: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("Post not found");
  }

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      coverImage: input.coverImage,
      categoryId: input.categoryId,
      readingTimeMinutes: calculateReadingTimeMinutes(input.content),
      published: input.published,
      publishedAt: input.published ? new Date() : null,
      tags: input.tagIds ? { set: input.tagIds.map((tagId) => ({ id: tagId })) } : undefined,
    },
    select: {
      id: true,
      slug: true,
      published: true,
      readingTimeMinutes: true,
      category: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  });

  revalidatePublicContent({
    slug: updated.published ? updated.slug : null,
    previousSlug: existing.slug,
    categorySlug: updated.published ? updated.category?.slug : null,
    previousCategorySlug: existing.category?.slug,
    tagSlugs: updated.published ? updated.tags.map((tag) => tag.slug) : [],
    previousTagSlugs: existing.tags.map((tag) => tag.slug),
  });

  return updated;
}
```

- [ ] **Step 5: Rerun the service test and the existing admin route tests**

Run: `pnpm exec vitest run src/lib/__tests__/ai-authoring.test.ts src/app/api/admin/posts/__tests__/route.test.ts src/app/api/admin/posts/[id]/__tests__/route.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai-contract.ts src/lib/ai-authoring.ts src/lib/__tests__/ai-authoring.test.ts src/lib/validation.ts src/app/api/admin/posts/route.ts src/app/api/admin/posts/[id]/route.ts
git commit -m "refactor(ai): share post authoring service"
```

---

### Task 3: Add the AI draft routes

**Files:**
- Create: `src/app/api/ai/meta/route.ts`
- Create: `src/app/api/ai/meta/__tests__/route.test.ts`
- Create: `src/app/api/ai/drafts/route.ts`
- Create: `src/app/api/ai/drafts/__tests__/route.test.ts`
- Create: `src/app/api/ai/drafts/[externalId]/route.ts`
- Create: `src/app/api/ai/drafts/[externalId]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing route tests**

Create `src/app/api/ai/meta/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAiClient = vi.fn();
const getCategoryDirectory = vi.fn();
const getTagDirectory = vi.fn();

vi.mock("@/lib/ai-auth", () => ({
  requireAiClient,
}));

vi.mock("@/lib/taxonomy", () => ({
  getCategoryDirectory,
  getTagDirectory,
}));

describe("GET /api/ai/meta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns live taxonomy and authoring limits", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1" });
    getCategoryDirectory.mockResolvedValueOnce([{ name: "Engineering", slug: "engineering", _count: { posts: 4 } }]);
    getTagDirectory.mockResolvedValueOnce([{ name: "Next.js", slug: "nextjs", _count: { posts: 2 } }]);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/ai/meta", {
      headers: { Authorization: "Bearer blog_ai_token_123" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.categories).toEqual([{ name: "Engineering", slug: "engineering", postCount: 4 }]);
    expect(payload.data.tags).toEqual([{ name: "Next.js", slug: "nextjs", postCount: 2 }]);
    expect(payload.data.limits.publishRequiresHumanReview).toBe(true);
  });
});
```

Create `src/app/api/ai/drafts/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAiClient = vi.fn();
const parseAiDraftInput = vi.fn();
const upsertAiDraft = vi.fn();

vi.mock("@/lib/ai-auth", () => ({
  requireAiClient,
}));

vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validation")>("@/lib/validation");
  return {
    ...actual,
    parseAiDraftInput,
  };
});

vi.mock("@/lib/ai-authoring", () => ({
  upsertAiDraft,
}));

describe("POST /api/ai/drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 201 when a new draft is created", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] });
    parseAiDraftInput.mockReturnValueOnce({
      externalId: "draft-001",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      tagSlugs: [],
    });
    upsertAiDraft.mockResolvedValueOnce({
      operation: "created",
      draft: { externalId: "draft-001", slug: "ai-writing" },
    });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/ai/drafts", {
      method: "POST",
      headers: {
        Authorization: "Bearer blog_ai_token_123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalId: "draft-001",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
      }),
    }));

    expect(response.status).toBe(201);
  });
});
```

Create `src/app/api/ai/drafts/[externalId]/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAiClient = vi.fn();
const getAiDraft = vi.fn();

vi.mock("@/lib/ai-auth", () => ({
  requireAiClient,
}));

vi.mock("@/lib/ai-authoring", () => ({
  getAiDraft,
}));

describe("GET /api/ai/drafts/[externalId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the stored draft for the authenticated client", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:read"] });
    getAiDraft.mockResolvedValueOnce({
      externalId: "draft-001",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      published: false,
      tagSlugs: [],
    });

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/ai/drafts/draft-001", {
        headers: { Authorization: "Bearer blog_ai_token_123" },
      }),
      { params: Promise.resolve({ externalId: "draft-001" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.externalId).toBe("draft-001");
  });
});
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run: `pnpm exec vitest run src/app/api/ai/meta/__tests__/route.test.ts src/app/api/ai/drafts/__tests__/route.test.ts src/app/api/ai/drafts/[externalId]/__tests__/route.test.ts`

Expected: FAIL because the route files do not exist yet.

- [ ] **Step 3: Implement the AI routes**

Create `src/app/api/ai/meta/route.ts`:

```ts
import { NextResponse } from "next/server";

import { requireAiClient } from "@/lib/ai-auth";
import { AI_AUTHORING_LIMITS, AI_AUTHORING_VERSION } from "@/lib/ai-contract";
import { toErrorResponse } from "@/lib/api-errors";
import { getCategoryDirectory, getTagDirectory } from "@/lib/taxonomy";

export async function GET(request: Request) {
  try {
    await requireAiClient(request, "taxonomy:read");

    const [categories, tags] = await Promise.all([
      getCategoryDirectory(),
      getTagDirectory(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        version: AI_AUTHORING_VERSION,
        limits: AI_AUTHORING_LIMITS,
        categories: categories.map((category) => ({
          name: category.name,
          slug: category.slug,
          postCount: category._count.posts,
        })),
        tags: tags.map((tag) => ({
          name: tag.name,
          slug: tag.slug,
          postCount: tag._count.posts,
        })),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

Create `src/app/api/ai/drafts/route.ts`:

```ts
import { NextResponse } from "next/server";

import { requireAiClient } from "@/lib/ai-auth";
import { upsertAiDraft } from "@/lib/ai-authoring";
import { toErrorResponse } from "@/lib/api-errors";
import { parseAiDraftInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const client = await requireAiClient(request, "drafts:write");
    const input = parseAiDraftInput(await request.json());
    const result = await upsertAiDraft({ client, input });

    return NextResponse.json(
      {
        success: true,
        operation: result.operation,
        data: result.draft,
      },
      { status: result.operation === "created" ? 201 : 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

Create `src/app/api/ai/drafts/[externalId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { requireAiClient } from "@/lib/ai-auth";
import { getAiDraft } from "@/lib/ai-authoring";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> },
) {
  try {
    const client = await requireAiClient(request, "drafts:read");
    const { externalId } = await params;
    const draft = await getAiDraft(client.id, externalId);

    return NextResponse.json({ success: true, data: draft });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 4: Rerun the route tests**

Run: `pnpm exec vitest run src/app/api/ai/meta/__tests__/route.test.ts src/app/api/ai/drafts/__tests__/route.test.ts src/app/api/ai/drafts/[externalId]/__tests__/route.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/meta/route.ts src/app/api/ai/meta/__tests__/route.test.ts src/app/api/ai/drafts/route.ts src/app/api/ai/drafts/__tests__/route.test.ts src/app/api/ai/drafts/[externalId]/route.ts src/app/api/ai/drafts/[externalId]/__tests__/route.test.ts
git commit -m "feat(ai): add draft authoring routes"
```

---

### Task 4: Publish the OpenAPI and llms discovery surfaces

**Files:**
- Create: `src/app/api/ai/openapi/route.ts`
- Create: `src/app/api/ai/openapi/__tests__/route.test.ts`
- Create: `src/app/llms.txt/route.ts`
- Create: `src/app/llms.txt/__tests__/route.test.ts`
- Create: `docs/integrations/ai-authoring-api.md`

- [ ] **Step 1: Write the failing docs-route tests**

Create `src/app/api/ai/openapi/__tests__/route.test.ts`:

```ts
import { describe, expect, test } from "vitest";

describe("GET /api/ai/openapi", () => {
  test("returns the ai authoring OpenAPI document", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/ai/openapi"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.openapi).toBe("3.1.0");
    expect(payload.paths["/api/ai/drafts"]).toBeDefined();
    expect(payload.components.securitySchemes.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
    });
  });
});
```

Create `src/app/llms.txt/__tests__/route.test.ts`:

```ts
import { describe, expect, test } from "vitest";

describe("GET /llms.txt", () => {
  test("returns a discovery document that points at the ai endpoints", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/llms.txt"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("/api/ai/openapi");
    expect(body).toContain("/api/ai/drafts");
    expect(body).toContain("Authorization: Bearer <token>");
  });
});
```

- [ ] **Step 2: Run the docs-route tests to verify they fail**

Run: `pnpm exec vitest run src/app/api/ai/openapi/__tests__/route.test.ts src/app/llms.txt/__tests__/route.test.ts`

Expected: FAIL because the docs routes do not exist yet.

- [ ] **Step 3: Implement the docs routes and operator guide**

Create `src/app/api/ai/openapi/route.ts`:

```ts
import { NextResponse } from "next/server";

import { AI_AUTHORING_ENDPOINTS, AI_AUTHORING_LIMITS, AI_AUTHORING_VERSION } from "@/lib/ai-contract";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "My Blog AI Authoring API",
      version: AI_AUTHORING_VERSION,
      description: "Machine-facing endpoints for AI clients to read taxonomy and upsert unpublished Markdown drafts.",
    },
    servers: [{ url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: {
        AiDraftInput: {
          type: "object",
          required: ["externalId", "title", "slug", "content"],
          properties: {
            externalId: { type: "string" },
            title: { type: "string", maxLength: AI_AUTHORING_LIMITS.titleMaxLength },
            slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
            content: { type: "string", description: "Markdown article body" },
            excerpt: { type: "string", maxLength: AI_AUTHORING_LIMITS.excerptMaxLength },
            coverImage: { type: "string" },
            categorySlug: { type: "string" },
            tagSlugs: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
    paths: {
      [AI_AUTHORING_ENDPOINTS.meta]: {
        get: {
          security: [{ bearerAuth: ["taxonomy:read"] }],
          responses: {
            "200": { description: "Authoring metadata and taxonomy" },
          },
        },
      },
      [AI_AUTHORING_ENDPOINTS.drafts]: {
        post: {
          security: [{ bearerAuth: ["drafts:write"] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AiDraftInput" },
              },
            },
          },
          responses: {
            "201": { description: "Draft created" },
            "200": { description: "Draft updated" },
          },
        },
      },
      "/api/ai/drafts/{externalId}": {
        get: {
          security: [{ bearerAuth: ["drafts:read"] }],
          parameters: [
            {
              name: "externalId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Stored draft" },
          },
        },
      },
    },
  });
}
```

Create `src/app/llms.txt/route.ts`:

```ts
import { AI_AUTHORING_ENDPOINTS, AI_AUTHORING_LIMITS } from "@/lib/ai-contract";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const body = [
    "# My Blog AI Authoring",
    "",
    "- Purpose: Create or update unpublished Markdown blog drafts for this site.",
    "- Authentication: Authorization: Bearer <token>",
    `- OpenAPI: ${baseUrl}${AI_AUTHORING_ENDPOINTS.openapi}`,
    `- Draft upsert: POST ${baseUrl}${AI_AUTHORING_ENDPOINTS.drafts}`,
    `- Draft readback: GET ${baseUrl}${AI_AUTHORING_ENDPOINTS.drafts}/{externalId}`,
    `- Live taxonomy: GET ${baseUrl}${AI_AUTHORING_ENDPOINTS.meta}`,
    `- Constraints: Markdown body required; title <= ${AI_AUTHORING_LIMITS.titleMaxLength}; excerpt <= ${AI_AUTHORING_LIMITS.excerptMaxLength}; publish requires human review.`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
```

Create `docs/integrations/ai-authoring-api.md`:

````md
# AI Authoring API

## Create a token

```bash
node --env-file=.env scripts/create-ai-api-token.mjs \
  --name codex \
  --owner-email admin@example.com \
  --scope drafts:read \
  --scope drafts:write \
  --scope taxonomy:read
```

## Read taxonomy and limits

```bash
curl -H "Authorization: Bearer $AI_TOKEN" \
  http://localhost:3000/api/ai/meta
```

## Upsert a draft

```bash
curl -X POST http://localhost:3000/api/ai/drafts \
  -H "Authorization: Bearer $AI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "draft-001",
    "title": "AI 写作接口实践",
    "slug": "ai-writing-api-practice",
    "content": "# 正文",
    "excerpt": "一篇关于 AI 发文接口的文章",
    "categorySlug": "engineering",
    "tagSlugs": ["nextjs", "api"]
  }'
```

## Read back the normalized draft

```bash
curl -H "Authorization: Bearer $AI_TOKEN" \
  http://localhost:3000/api/ai/drafts/draft-001
```
````

- [ ] **Step 4: Rerun the docs-route tests**

Run: `pnpm exec vitest run src/app/api/ai/openapi/__tests__/route.test.ts src/app/llms.txt/__tests__/route.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/openapi/route.ts src/app/api/ai/openapi/__tests__/route.test.ts src/app/llms.txt/route.ts src/app/llms.txt/__tests__/route.test.ts docs/integrations/ai-authoring-api.md
git commit -m "docs(ai): publish authoring contract surfaces"
```

---

### Task 5: Run final verification and smoke the token bootstrap flow

**Files:**
- Review only unless regressions are found

- [ ] **Step 1: Run the targeted AI test suite**

Run:

```bash
pnpm exec vitest run \
  src/lib/__tests__/ai-auth.test.ts \
  src/lib/__tests__/ai-authoring.test.ts \
  src/app/api/admin/posts/__tests__/route.test.ts \
  src/app/api/admin/posts/[id]/__tests__/route.test.ts \
  src/app/api/ai/meta/__tests__/route.test.ts \
  src/app/api/ai/drafts/__tests__/route.test.ts \
  src/app/api/ai/drafts/[externalId]/__tests__/route.test.ts \
  src/app/api/ai/openapi/__tests__/route.test.ts \
  src/app/llms.txt/__tests__/route.test.ts
```

Expected: PASS

- [ ] **Step 2: Run static verification**

Run: `pnpm lint`

Expected: PASS

Run: `pnpm build`

Expected: PASS

- [ ] **Step 3: Smoke the token bootstrap and live meta endpoint**

Run:

```bash
node --env-file=.env scripts/create-ai-api-token.mjs \
  --name codex-smoke \
  --owner-email admin@example.com \
  --scope drafts:read \
  --scope drafts:write \
  --scope taxonomy:read
```

Expected: JSON output containing a one-time `token` value.

Then run:

```bash
curl -H "Authorization: Bearer <token-from-previous-step>" \
  http://localhost:3000/api/ai/meta
```

Expected: `200 OK` with `categories`, `tags`, and `limits`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/202604120001_add_ai_authoring_clients/migration.sql scripts/create-ai-api-token.mjs src/lib/ai-auth.ts src/lib/ai-contract.ts src/lib/ai-authoring.ts src/lib/validation.ts src/lib/__tests__/ai-auth.test.ts src/lib/__tests__/ai-authoring.test.ts src/app/api/admin/posts/route.ts src/app/api/admin/posts/[id]/route.ts src/app/api/ai docs/integrations/ai-authoring-api.md
git commit -m "feat(ai): ship ai authoring api foundation"
```

---

## Final Verification Sequence

1. `pnpm prisma generate`
2. `pnpm exec vitest run src/lib/__tests__/ai-auth.test.ts src/lib/__tests__/ai-authoring.test.ts src/app/api/admin/posts/__tests__/route.test.ts src/app/api/admin/posts/[id]/__tests__/route.test.ts src/app/api/ai/meta/__tests__/route.test.ts src/app/api/ai/drafts/__tests__/route.test.ts src/app/api/ai/drafts/[externalId]/__tests__/route.test.ts src/app/api/ai/openapi/__tests__/route.test.ts src/app/llms.txt/__tests__/route.test.ts`
3. `pnpm lint`
4. `pnpm build`
5. `node --env-file=.env scripts/create-ai-api-token.mjs --name codex-smoke --owner-email admin@example.com --scope drafts:read --scope drafts:write --scope taxonomy:read`
6. `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/ai/meta`

Expected:

- Prisma client generates successfully
- targeted AI and admin regression tests PASS
- lint PASSes
- production build PASSes
- token bootstrap emits a one-time bearer token
- the live meta endpoint returns the documented contract

## Non-Goals

- No direct AI publish endpoint
- No moderation state machine beyond `published=false`
- No remote MCP server in this phase
- No replacement of the human admin UI
