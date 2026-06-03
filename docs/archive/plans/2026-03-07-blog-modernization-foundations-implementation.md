# Blog Modernization Foundations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the current P0 privilege-escalation risk and implement the P1-grade security, SEO, caching, and account-lifecycle foundations expected of a modern blog.

**Architecture:** First harden the platform layer: remove the dangerous admin bootstrap route, introduce shared request validation and rate limiting, and add site-wide security headers. Then build a proper content-distribution layer with site metadata, metadata routes, JSON-LD, RSS, and ISR-based public caching. Finally, complete the authentication lifecycle with email verification and password reset flows using Prisma-backed tokens.

**Tech Stack:** Next.js 16 App Router, TypeScript, NextAuth v4, Prisma 7, PostgreSQL, Vitest, Playwright, React Markdown, Qiniu upload

---

## Scope Notes

- This plan intentionally covers the report's `P0 + P1` items first.
- `P2/P3` items such as search ranking, observability, comment moderation workflows, and upload media processing stay out of this plan.
- Follow `@superpowers:test-driven-development` while implementing each task.
- After each task, stop and verify before continuing.
- Prefer incremental rollout over a single large merge: security fixes first, then metadata/caching, then auth lifecycle.
- Any task that introduces new environment variables must also update `.env.example` and the relevant README/deployment notes before it is considered complete.

### Task 1: Remove Public Admin Bootstrap Route

**Files:**
- Modify: `src/app/api/admin/set-admin/route.ts`
- Create: `src/app/api/admin/set-admin/__tests__/route.test.ts`
- Modify: `README.md`

**Step 1: Write the failing regression test**

```ts
import { describe, expect, test } from "vitest";
import { POST } from "../route";

describe("POST /api/admin/set-admin", () => {
  test("returns not found and never promotes a user", async () => {
    const request = new Request("http://localhost/api/admin/set-admin", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Not found");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/api/admin/set-admin/__tests__/route.test.ts`
Expected: FAIL because the current route still updates a user's role.

**Step 3: Write minimal implementation**

```ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

Also add a short README note that administrator bootstrapping must happen through Prisma seed / direct database migration, not HTTP.

Before closing the task, add an operational follow-up note for production owners: audit the `users` table for unexpected `ADMIN` records created before `2026-03-07`, confirm each record is legitimate, and rotate long-lived sessions if an unexpected admin is found.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/api/admin/set-admin/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/admin/set-admin/route.ts src/app/api/admin/set-admin/__tests__/route.test.ts README.md
git commit -m "fix: remove public admin bootstrap route"
```

### Task 2: Introduce Shared Request Validation and Query Clamping

**Files:**
- Create: `src/lib/validation.ts`
- Create: `src/lib/__tests__/validation.test.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/comments/route.ts`
- Modify: `src/app/api/posts/route.ts`
- Modify: `src/app/api/posts/[slug]/route.ts`
- Modify: `src/app/api/admin/uploads/qiniu-token/route.ts`

**Step 1: Write the failing validation tests**

```ts
import { describe, expect, test } from "vitest";
import {
  clampPagination,
  parseLoginInput,
  parseRegisterInput,
  parseUploadRequest,
} from "../validation";

describe("validation helpers", () => {
  test("clamps page and limit", () => {
    expect(clampPagination({ page: "0", limit: "500" })).toEqual({ page: 1, limit: 50 });
  });

  test("rejects short passwords", () => {
    expect(() => parseRegisterInput({ email: "a@b.com", password: "123" })).toThrow();
  });

  test("rejects non-string upload filename", () => {
    expect(() => parseUploadRequest({ filename: 123 })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/validation.test.ts`
Expected: FAIL because `src/lib/validation.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create a small shared validation module without overengineering. Keep it framework-light and deterministic.

```ts
const MAX_LIMIT = 50;

export function clampPagination(input: { page?: string | null; limit?: string | null }) {
  const page = Math.max(1, Number.parseInt(input.page ?? "1", 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(input.limit ?? "10", 10) || 10));
  return { page, limit };
}

export function parseRegisterInput(payload: unknown) {
  const data = payload as { email?: unknown; password?: unknown; name?: unknown };
  if (typeof data.email !== "string" || !data.email.includes("@")) throw new Error("Invalid email");
  if (typeof data.password !== "string" || data.password.length < 8) throw new Error("Invalid password");
  return {
    email: data.email.trim().toLowerCase(),
    password: data.password,
    name: typeof data.name === "string" ? data.name.trim() : "",
  };
}
```

Apply the same pattern to login, comments, post mutation payloads, and upload requests. Replace direct `request.json()` destructuring with parsed values. Clamp `page` and `limit` in `src/app/api/posts/route.ts`.

**Step 4: Run tests to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/validation.test.ts`
Expected: PASS

Run: `pnpm exec vitest run src/app/api/admin/uploads/__tests__/qiniu-token.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/__tests__/validation.test.ts src/app/api/auth/register/route.ts src/app/api/auth/login/route.ts src/app/api/comments/route.ts src/app/api/posts/route.ts src/app/api/posts/[slug]/route.ts src/app/api/admin/uploads/qiniu-token/route.ts
git commit -m "feat: add shared api validation and query clamping"
```

### Task 3: Add Rate Limiting for Auth and Interaction Endpoints

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `src/lib/__tests__/rate-limit.test.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/comments/route.ts`
- Modify: `src/app/api/posts/[slug]/like/route.ts`
- Modify: `src/app/api/posts/[slug]/bookmark/route.ts`
- Modify: `src/app/api/admin/uploads/qiniu-token/route.ts`

**Step 1: Write the failing rate-limit tests**

```ts
import { describe, expect, test } from "vitest";
import { createMemoryRateLimiter } from "../rate-limit";

describe("rate limiter", () => {
  test("blocks requests over the limit", () => {
    const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 60_000 });

    expect(limiter.check("ip:1").allowed).toBe(true);
    expect(limiter.check("ip:1").allowed).toBe(true);
    expect(limiter.check("ip:1").allowed).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/rate-limit.test.ts`
Expected: FAIL because `src/lib/rate-limit.ts` does not exist yet.

**Step 3: Write minimal implementation**

```ts
type HitWindow = { count: number; resetAt: number };

export function createMemoryRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const store = new Map<string, HitWindow>();

  return {
    check(key: string) {
      const now = Date.now();
      const current = store.get(key);
      if (!current || current.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1 };
      }
      if (current.count >= limit) {
        return { allowed: false, remaining: 0 };
      }
      current.count += 1;
      return { allowed: true, remaining: limit - current.count };
    },
  };
}
```

Wire the limiter into sensitive endpoints with conservative rules:

- register/login: low threshold
- comments: medium threshold
- like/bookmark: medium threshold
- qiniu-token: low threshold

Document the limitation clearly in code comments or README notes: this first version is suitable for single-instance development and small deployments, but multi-instance/serverless production should move the same interface to Redis or another shared store without changing route handlers.

For each protected route, return `429` with a stable error payload:

```ts
return NextResponse.json({ error: "Too many requests" }, { status: 429 });
```

**Step 4: Run tests to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/rate-limit.test.ts`
Expected: PASS

Then run one route-adjacent suite:

Run: `pnpm exec vitest run src/app/api/admin/uploads/__tests__/qiniu-token.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/__tests__/rate-limit.test.ts src/app/api/auth/register/route.ts src/app/api/auth/login/route.ts src/app/api/comments/route.ts src/app/api/posts/[slug]/like/route.ts src/app/api/posts/[slug]/bookmark/route.ts src/app/api/admin/uploads/qiniu-token/route.ts
git commit -m "feat: add rate limiting to sensitive blog endpoints"
```

### Task 4: Add Site Security Headers and Middleware Foundation

**Files:**
- Create: `src/lib/security-headers.ts`
- Create: `src/lib/__tests__/security-headers.test.ts`
- Modify: `next.config.ts`
- Create: `middleware.ts`

**Step 1: Write the failing header-config test**

```ts
import { describe, expect, test } from "vitest";
import { securityHeaders } from "../security-headers";

describe("security headers", () => {
  test("includes baseline hardening headers", () => {
    const keys = securityHeaders.map((item) => item.key);
    expect(keys).toContain("Content-Security-Policy");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("X-Content-Type-Options");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/security-headers.test.ts`
Expected: FAIL because the helper file does not exist yet.

**Step 3: Write minimal implementation**

Create a reusable header list:

```ts
export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:;" },
];
```

Then consume it from `next.config.ts` via `headers()` and create a lightweight `middleware.ts` that only centralizes route matching / future edge protection without changing app behavior today.

Before enabling CSP broadly, build an explicit allowlist checklist for the current app surface:

- local Next.js assets and fonts
- Qiniu upload/download origins
- any image CDN or remote image domains already used by public posts
- authentication routes and callback paths
- analytics or third-party embeds if present

Start with `default-src 'self'` and narrowly add directives that are proven necessary during build/runtime verification. Do not ship wildcard hosts unless a failing feature has been investigated and documented.

**Step 4: Run tests and build verification**

Run: `pnpm exec vitest run src/lib/__tests__/security-headers.test.ts`
Expected: PASS

Run: `pnpm build`
Expected: PASS with Next.js build completing successfully.

**Step 5: Commit**

```bash
git add src/lib/security-headers.ts src/lib/__tests__/security-headers.test.ts next.config.ts middleware.ts
git commit -m "feat: add blog security headers foundation"
```

### Task 5: Add Site Metadata, Metadata Routes, and Real RSS Output

**Files:**
- Create: `src/lib/site.ts`
- Create: `src/lib/seo.ts`
- Create: `src/lib/__tests__/seo.test.ts`
- Modify: `src/app/layout.tsx`
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`
- Create: `src/app/manifest.ts`
- Create: `src/app/rss.xml/route.ts`
- Modify: `src/components/layout/Footer.tsx`

**Step 1: Write the failing SEO helper tests**

```ts
import { describe, expect, test } from "vitest";
import { absoluteUrl, buildPageTitle } from "../seo";

describe("seo helpers", () => {
  test("builds absolute urls from site config", () => {
    expect(absoluteUrl("/posts/hello")).toBe("https://example.com/posts/hello");
  });

  test("builds page title with site suffix", () => {
    expect(buildPageTitle("文章列表")).toBe("文章列表 | My Blog");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/seo.test.ts`
Expected: FAIL because the helper files do not exist yet.

**Step 3: Write minimal implementation**

Create `src/lib/site.ts` with stable site config:

```ts
export const siteConfig = {
  name: "My Blog",
  description: "A modern blog built with Next.js",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com",
  locale: "zh-CN",
};
```

Create `src/lib/seo.ts` with helpers such as `absoluteUrl`, `buildPageTitle`, and JSON-LD builders. Then:

- upgrade `src/app/layout.tsx` metadata to use `metadataBase`, title template, OG, Twitter, alternates
- add `robots.ts`, `sitemap.ts`, `manifest.ts`
- add `rss.xml/route.ts` that queries published posts and returns XML
- keep the footer RSS link, now backed by a real route

**Step 4: Run tests and build verification**

Run: `pnpm exec vitest run src/lib/__tests__/seo.test.ts`
Expected: PASS

Run: `pnpm build`
Expected: PASS and metadata routes compile.

**Step 5: Commit**

```bash
git add src/lib/site.ts src/lib/seo.ts src/lib/__tests__/seo.test.ts src/app/layout.tsx src/app/robots.ts src/app/sitemap.ts src/app/manifest.ts src/app/rss.xml/route.ts src/components/layout/Footer.tsx
git commit -m "feat: add metadata routes and rss feed"
```

### Task 6: Add Per-Page Metadata and Article JSON-LD

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/posts/page.tsx`
- Modify: `src/app/(public)/posts/[slug]/page.tsx`
- Modify: `src/app/(public)/categories/page.tsx`
- Modify: `src/app/(public)/categories/[slug]/page.tsx`
- Modify: `src/app/(public)/tags/page.tsx`
- Modify: `src/app/(public)/tags/[slug]/page.tsx`
- Modify: `src/lib/seo.ts`
- Create: `src/app/posts/[slug]/__tests__/article-metadata.test.tsx`

**Step 1: Write the failing article metadata test**

```ts
import { describe, expect, test } from "vitest";
import { buildArticleJsonLd } from "@/lib/seo";

describe("article seo", () => {
  test("builds BlogPosting json-ld", () => {
    const json = buildArticleJsonLd({
      title: "Hello",
      slug: "hello",
      description: "Intro",
      publishedAt: new Date("2026-03-07T00:00:00.000Z"),
      updatedAt: new Date("2026-03-07T00:00:00.000Z"),
      authorName: "OpenAI",
    });

    expect(json["@type"]).toBe("BlogPosting");
    expect(json.headline).toBe("Hello");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/posts/[slug]/__tests__/article-metadata.test.tsx`
Expected: FAIL until the helper and page metadata are implemented.

**Step 3: Write minimal implementation**

For each public page, export `generateMetadata` and keep the metadata logic in helpers rather than inline duplication. In the article page:

- derive title, description, canonical, OG/Twitter image
- inject JSON-LD with `BlogPosting`
- prefer `post.excerpt` as description and fall back to a trimmed content summary

Minimal page pattern:

```ts
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return buildArticleMetadata(post);
}
```

**Step 4: Run tests and targeted page verification**

Run: `pnpm exec vitest run src/app/posts/[slug]/__tests__/article-metadata.test.tsx`
Expected: PASS

Run: `pnpm exec vitest run src/app/posts/[slug]/__tests__/article-experience.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/(public)/page.tsx src/app/(public)/posts/page.tsx src/app/(public)/posts/[slug]/page.tsx src/app/(public)/categories/page.tsx src/app/(public)/categories/[slug]/page.tsx src/app/(public)/tags/page.tsx src/app/(public)/tags/[slug]/page.tsx src/lib/seo.ts src/app/posts/[slug]/__tests__/article-metadata.test.tsx
git commit -m "feat: add page metadata and article json-ld"
```

### Task 7: Replace `force-dynamic` Public Pages with ISR and Targeted Revalidation

**Files:**
- Create: `src/lib/cache.ts`
- Create: `src/lib/__tests__/cache.test.ts`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/archives/page.tsx`
- Modify: `src/app/(public)/posts/page.tsx`
- Modify: `src/app/(public)/posts/[slug]/page.tsx`
- Modify: `src/app/api/posts/route.ts`
- Modify: `src/app/api/posts/[slug]/route.ts`
- Modify: `src/app/api/admin/posts/route.ts`
- Modify: `src/app/api/admin/posts/[id]/route.ts`
- Modify: `src/app/api/admin/posts/publish/route.ts`

**Step 1: Write the failing cache policy tests**

```ts
import { describe, expect, test } from "vitest";
import { PUBLIC_REVALIDATE_SECONDS, buildPostPath } from "../cache";

describe("cache helpers", () => {
  test("exposes stable public revalidate window", () => {
    expect(PUBLIC_REVALIDATE_SECONDS).toBe(300);
  });

  test("builds canonical post path", () => {
    expect(buildPostPath("hello")).toBe("/posts/hello");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/cache.test.ts`
Expected: FAIL because the cache helper file does not exist yet.

**Step 3: Write minimal implementation**

Create a small helper:

```ts
export const PUBLIC_REVALIDATE_SECONDS = 300;

export function buildPostPath(slug: string) {
  return `/posts/${slug}`;
}
```

Then:

- replace `export const dynamic = "force-dynamic";` with `export const revalidate = PUBLIC_REVALIDATE_SECONDS;` on public content pages
- add `generateStaticParams` for article detail pages based on published slugs
- call `revalidatePath("/")`, `revalidatePath("/posts")`, and `revalidatePath(buildPostPath(slug))` after create/update/publish/delete flows

Do **not** convert logged-in pages like bookmarks or admin routes to ISR.

Add a small revalidation matrix to the implementation notes for this task and match route behavior to it:

| Write event | Required revalidation |
| --- | --- |
| create published post | `/`, `/posts`, `/archives`, post detail path |
| update published post | post detail path, and listing pages if title/excerpt/date/category/tag changed |
| unpublish/delete post | `/`, `/posts`, `/archives`, old post detail path |
| publish scheduled/draft post | `/`, `/posts`, `/archives`, post detail path |

If category/tag listing pages participate in public navigation, revalidate those paths too whenever taxonomy assignment changes.

**Step 4: Run tests and build verification**

Run: `pnpm exec vitest run src/lib/__tests__/cache.test.ts`
Expected: PASS

Run: `pnpm build`
Expected: PASS with public pages compiling under ISR.

**Step 5: Commit**

```bash
git add src/lib/cache.ts src/lib/__tests__/cache.test.ts src/app/(public)/page.tsx src/app/(public)/archives/page.tsx src/app/(public)/posts/page.tsx src/app/(public)/posts/[slug]/page.tsx src/app/api/posts/route.ts src/app/api/posts/[slug]/route.ts src/app/api/admin/posts/route.ts src/app/api/admin/posts/[id]/route.ts src/app/api/admin/posts/publish/route.ts
git commit -m "feat: add isr and public content revalidation"
```

### Task 8: Prepare Auth Data Model, Mailer, and Environment Contract

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_auth_lifecycle_foundations/migration.sql`
- Create: `src/lib/email.ts`
- Create: `src/lib/tokens.ts`
- Create: `src/lib/__tests__/tokens.test.ts`
- Modify: `README.md`
- Modify: `.env.example`

**Step 1: Write the failing token and foundation tests**

```ts
import { describe, expect, test } from "vitest";
import { EMAIL_VERIFICATION_TTL_HOURS, PASSWORD_RESET_TTL_MINUTES, hashToken } from "../tokens";

describe("auth lifecycle foundations", () => {
  test("exposes stable token TTLs", () => {
    expect(PASSWORD_RESET_TTL_MINUTES).toBe(30);
    expect(EMAIL_VERIFICATION_TTL_HOURS).toBe(24);
  });

  test("hashes tokens deterministically", async () => {
    await expect(hashToken("abc")).resolves.toHaveLength(64);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/tokens.test.ts`
Expected: FAIL because the token helper does not exist yet.

**Step 3: Write minimal implementation**

- decide whether to reuse `VerificationToken` for email verification only and add a dedicated password reset token model, or add one unified app-owned token model with explicit `type`
- prefer explicit application-owned semantics over overloading auth-adapter storage when it keeps route logic simpler
- implement `src/lib/email.ts` as a small transport abstraction with a development fallback that logs payloads and a production branch that reads required env vars
- define and document all required environment variables in `.env.example` and `README.md`, including `NEXTAUTH_URL`, mail sender settings, and any site URL used in email links

The migration must be committed as part of the task. Do not leave schema changes without a checked-in Prisma migration.

**Step 4: Run focused verification**

Run: `pnpm exec vitest run src/lib/__tests__/tokens.test.ts`
Expected: PASS

Run: `pnpm prisma validate`
Expected: PASS

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/email.ts src/lib/tokens.ts src/lib/__tests__/tokens.test.ts README.md .env.example
git commit -m "feat: add auth lifecycle foundations"
```

### Task 9: Add Email Verification and Password Reset Lifecycle

**Files:**
- Create: `src/app/api/auth/verify-email/route.ts`
- Create: `src/app/api/auth/request-password-reset/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `src/app/(auth)/verify-email/page.tsx`
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Create: `src/app/(auth)/reset-password/page.tsx`
- Create: `src/app/api/auth/__tests__/email-lifecycle.test.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/lib/auth.ts`

**Step 1: Write the failing lifecycle tests**

```ts
import { describe, expect, test } from "vitest";

describe("auth lifecycle", () => {
  test("requires email verification before credentials login", async () => {
    expect(true).toBe(false);
  });

  test("consumes password reset token once", async () => {
    expect(true).toBe(false);
  });
});
```

Replace the placeholders with real route-level tests once scaffolding is in place.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/api/auth/__tests__/email-lifecycle.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

Build on the token and mailer primitives from Task 8 rather than re-deciding them here.

Required behavior:

- registration creates the user and sends a verification token
- credentials login rejects unverified email/password accounts with a stable error such as `EmailNotVerified`
- verify-email route marks `emailVerified`
- forgot-password route issues a one-time token
- reset-password route updates the password and invalidates the token
- password-reset requests return stable, non-enumerating responses for unknown email addresses
- verify/reset pages handle expired or already-consumed tokens gracefully without exposing internals
- successful password reset should invalidate existing sessions if the current auth/session architecture supports it; otherwise document the limitation explicitly as follow-up work

**Step 4: Run tests and auth verification**

Run: `pnpm exec vitest run src/app/api/auth/__tests__/email-lifecycle.test.ts`
Expected: PASS

Run: `pnpm exec vitest run src/lib/__tests__/tokens.test.ts`
Expected: PASS to confirm the shared auth foundations still hold.

Run: `pnpm build`
Expected: PASS with new auth routes and pages compiling.

**Step 5: Commit**

```bash
git add src/app/api/auth/verify-email/route.ts src/app/api/auth/request-password-reset/route.ts src/app/api/auth/reset-password/route.ts src/app/(auth)/verify-email/page.tsx src/app/(auth)/forgot-password/page.tsx src/app/(auth)/reset-password/page.tsx src/app/api/auth/__tests__/email-lifecycle.test.ts src/app/api/auth/register/route.ts src/lib/auth.ts
git commit -m "feat: add email verification and password reset lifecycle"
```

---

## Final Verification Sequence

After Task 9, run the full verification sequence before claiming the P0/P1 milestone is complete:

1. `pnpm exec vitest run src/lib/__tests__/validation.test.ts src/lib/__tests__/rate-limit.test.ts src/lib/__tests__/security-headers.test.ts src/lib/__tests__/seo.test.ts src/lib/__tests__/cache.test.ts src/lib/__tests__/tokens.test.ts src/app/api/admin/set-admin/__tests__/route.test.ts src/app/api/auth/__tests__/email-lifecycle.test.ts`
2. `pnpm test`
3. `pnpm build`
4. `pnpm exec playwright test e2e/reader.spec.ts`
5. `pnpm prisma validate`

Expected:

- all targeted Vitest suites PASS
- the full `pnpm test` suite PASSes
- production build PASSes
- reader E2E PASSes with metadata routes and public pages intact
- Prisma schema validates with committed auth-lifecycle migrations present

## Rollout Order

1. Ship Task 1 immediately as an emergency fix.
2. Ship Tasks 2–4 together as the security foundation batch.
3. Ship Tasks 5–7 together as the SEO + caching batch.
4. Ship Task 8 first inside the auth workstream so schema, mailer, env vars, and token primitives land before user-facing flows.
5. Ship Task 9 as a separate auth-lifecycle batch because it changes user-facing flows.

## Non-Goals

- No search-engine upgrade in this plan.
- No observability vendor integration in this plan.
- No comment moderation queue in this plan.
- No image transcoding pipeline in this plan.

## Implementation Notes for the Engineer

- Prefer introducing small helpers in `src/lib` over copying logic across route files.
- Keep new abstractions boring: simple functions and plain objects beat generic frameworks here.
- Avoid mixing the email-lifecycle task into the earlier security/SEO tasks.
- Do not keep `force-dynamic` on public content routes after ISR is in place.
- Do not reintroduce any HTTP path that can assign `ADMIN` role outside an authenticated admin session or offline bootstrap.
- Treat migrations, `.env.example`, and README/deployment notes as part of the definition of done for any auth-lifecycle work.
- When adding rate limiting or CSP, prefer explicit documented limitations over pretending the first implementation is production-perfect.
