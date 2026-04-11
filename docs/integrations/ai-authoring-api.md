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
