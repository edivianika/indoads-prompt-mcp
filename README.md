# IndoAds Prompt MCP

A retrieval-first prompt engine for commercial advertising. It **does not generate images**. It stores curated visual concepts, ranks them against a product brief, and composes a final prompt that ChatGPT can pass to GPT Image, Nano Banana, Seedream, Midjourney, Flux, or another image model.

## What is included

- Remote MCP endpoint: `POST /mcp`
- REST API for Custom GPT Actions
- OpenAPI schema: `/openapi.yaml`
- Curated concepts across F&B, beauty, fashion, tech, home/property, automotive and general e-commerce
- Search/ranking with product fit, objective, style, platform, ratio and contextual product/audience details
- Diversity-aware recommendation
- Product-reference fidelity protection
- Optional Bearer API key
- Read-only MCP annotations for prompt tools

## Core MCP tools

1. `generateAdPrompt` — **preferred default for direct ad creation**. Selects the best concept and composes the final image-generation prompt in one external call.
2. `recommend_ad_prompts` — return multiple concept options when the user explicitly wants to choose.
3. `search_ad_prompts` — browse/search the concept library.
4. `get_ad_prompt` — inspect one known concept ID.
5. `compose_ad_prompt` — compose from an already selected concept ID.
6. `list_prompt_taxonomy` — discover supported filters.

All of the tools above only read/process the server's prompt library. They do not mutate external state. The MCP registrations advertise read-only/idempotent/closed-world annotations supported by the current MCP SDK. These annotations are client hints; they do not guarantee that a ChatGPT permission dialog will be skipped.

## Recommended one-call ChatGPT workflow

1. User uploads/describes a product and asks to make an ad.
2. ChatGPT infers useful fields such as category, product type, product description, objective, target audience, style, platform and aspect ratio.
3. ChatGPT calls `generateAdPrompt` once.
4. The server ranks concepts internally, selects the best one, composes the final prompt, and returns the prompt plus concept metadata.
5. ChatGPT uses the returned `prompt` directly with image generation if the user asks to generate.

Do **not** call `recommend_ad_prompts → get_ad_prompt → compose_ad_prompt` after `generateAdPrompt` has already returned a final prompt.

The older multi-step workflow remains available for users who explicitly want multiple concepts before choosing.

## Local run

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

One-call generate test:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H 'content-type: application/json' \
  -d '{
    "productName":"Lumina Serum",
    "brandName":"Lumina",
    "productDescription":"Brightening facial serum with niacinamide",
    "keyBenefit":"Brighter looking skin",
    "targetAudience":"Women 20-35",
    "objective":"conversion",
    "style":"premium",
    "platform":"Instagram",
    "aspectRatio":"4:5",
    "copyText":"Glow Starts Here"
  }'
```

Expected response includes:

```json
{
  "prompt": "...final image-generation prompt...",
  "concept": {
    "id": "...",
    "name": "...",
    "style": "premium",
    "objective": "conversion"
  },
  "aspectRatio": "4:5",
  "platform": "Instagram"
}
```

Recommendation flow when the user wants options:

```bash
curl -X POST http://localhost:3000/api/recommend \
  -H 'content-type: application/json' \
  -d '{"category":"fnb","productType":"sambal","query":"spicy authentic premium","aspectRatio":"4:5","count":6}'
```

Compose from a known ID:

```bash
curl -X POST http://localhost:3000/api/compose \
  -H 'content-type: application/json' \
  -d '{"promptId":"FNB-001","productName":"Sambel Pecel Marimar","productDescription":"standing pouch with red-green label","hasReferenceImage":true,"platform":"Instagram","aspectRatio":"4:5"}'
```

## Use from a Custom GPT through Actions

Deploy this project to a public HTTPS domain, then in the GPT editor open **Actions → Create new action** and import:

`https://YOUR_DOMAIN/openapi.yaml`

The OpenAPI operation `generateAdPrompt` is the preferred action for direct “make an ad” requests. Existing operation IDs remain available for backward compatibility.

If you set `INDOADS_API_KEY`, configure the GPT Action authentication as a Bearer API key with the same value. If the variable is blank, the API remains read-only and unauthenticated.

## Use as Remote MCP

Deploy on HTTPS and point the MCP-capable client to:

`https://YOUR_DOMAIN/mcp`

The MCP implementation is stateless and read-only. The privacy endpoint remains available at `/privacy`.

## Add more prompt concepts

Edit the prompt corpus/seeds used by the project. Each concept stores art-direction components rather than a single giant prompt, including product/category fit, objective, visual concept, style tags, composition, lighting, camera, background/set, effects, copy zone, negative constraints, model hints and quality score.

## License

Project scaffold: use/modify privately as needed. Prompt seed data in this project is original starter content and not copied verbatim from third-party prompt repositories.
