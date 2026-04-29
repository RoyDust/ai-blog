# AI Authoring API

## Create a token

```bash
node --env-file=.env scripts/create-ai-api-token.mjs \
  --name codex \
  --email admin@example.com \
  --scopes drafts:read,drafts:write,taxonomy:read
```

## Read taxonomy and limits

```bash
curl -H "Authorization: Bearer $AI_TOKEN" \
  http://localhost:3000/api/ai/meta
```

## Discovery surfaces

```bash
curl http://localhost:3000/api/ai/openapi
```

```bash
curl http://localhost:3000/llms.txt
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


## Automatic review and publishing

`POST /api/ai/drafts` first creates or updates an unpublished post, then runs the same AI review model used by the admin publishing checklist. If the review verdict is `ready`, the score is at least 85, and no review check has `fail` status, the post is automatically published and public caches are revalidated.

The upsert response includes `data.published` and an `autoReview` object when review ran:

```json
{
  "success": true,
  "operation": "created",
  "data": { "externalId": "draft-001", "postId": "...", "slug": "ai-writing-api-practice", "published": true },
  "autoReview": { "verdict": "ready", "score": 91, "summary": "可以发布", "published": true }
}
```

If review is not configured or does not pass, the post remains a draft for human review.
