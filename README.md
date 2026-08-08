# IndoAds Prompt MCP

A retrieval-first prompt engine for commercial advertising. It **does not generate images**. It stores curated visual concepts, ranks them against a product brief, and composes a final prompt that ChatGPT can pass to GPT Image, Nano Banana, Seedream, Midjourney, Flux, or another image model.

## What is included

- Remote MCP endpoint: `POST /mcp`
- REST API for Custom GPT Actions
- OpenAPI schema: `/openapi.yaml`
- 40+ curated seed concepts across F&B, beauty, fashion, tech, home/property, automotive and general e-commerce
- Search/ranking with category, product type, objective, style, platform, ratio and model hints
- Diversity-aware recommendation so the top 10 are not ten versions of the same idea
- Product-reference fidelity block to protect packaging/logo details
- Dockerfile + Render deployment blueprint
- Optional Bearer API key

## Core MCP tools

1. `recommend_ad_prompts` — best first call after ChatGPT analyzes an uploaded product image.
2. `search_ad_prompts` — targeted search across the library.
3. `get_ad_prompt` — inspect one concept in full.
4. `compose_ad_prompt` — build the final model-ready prompt.
5. `list_prompt_taxonomy` — discover supported filters.

## Recommended ChatGPT workflow

1. User uploads a product image.
2. ChatGPT identifies product type, category, visible packaging, dominant colors, likely objective, platform and ratio.
3. ChatGPT calls `recommend_ad_prompts` and asks for 6–10 **diverse** concepts.
4. Present only concept names + one-line explanations; do not dump full prompts yet.
5. User chooses a concept.
6. ChatGPT calls `compose_ad_prompt` with `hasReferenceImage=true` and the visual details it saw in the upload.
7. Return the final prompt or send it to the selected image-generation capability.

## Local run

```bash
cp .env.example .env
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Search:

```bash
curl -X POST http://localhost:3000/api/recommend \
  -H 'content-type: application/json' \
  -d '{"category":"fnb","productType":"sambal","query":"spicy authentic premium","aspectRatio":"4:5","count":6}'
```

Compose:

```bash
curl -X POST http://localhost:3000/api/compose \
  -H 'content-type: application/json' \
  -d '{"promptId":"FNB-001","productName":"Sambel Pecel Marimar","productDescription":"standing pouch with red-green label","hasReferenceImage":true,"aspectRatio":"4:5"}'
```

## Use from a Custom GPT through Actions

Deploy this project to a public HTTPS domain, then in the GPT editor open **Actions → Create new action** and import:

`https://YOUR_DOMAIN/openapi.yaml`

If you set `INDOADS_API_KEY`, configure the GPT Action authentication as a Bearer API key with the same value. If the variable is blank, the API is read-only and unauthenticated.

### Suggested GPT instruction

```text
When the user asks for an ad image or uploads a product, do not immediately invent one generic prompt.
First analyze the uploaded product visually. Call recommendAdPrompts with the inferred category, product type, objective, desired style, platform, aspect ratio, and a concise productDescription. Ask for 6-10 diverse concepts.
Present the concept menu with IDs. After the user chooses, call composeAdPrompt and include the exact visible product details, hasReferenceImage=true, and the desired aspect ratio.
Never claim the Action generated an image. It only retrieves and composes prompts.
Preserve product packaging, label, logo, brand colors and proportions exactly when a reference image is supplied.
```

## Use as Remote MCP

Deploy on HTTPS and point the MCP-capable client to:

`https://YOUR_DOMAIN/mcp`

The server exposes the same retrieval engine through MCP tools. The MCP implementation is stateless and read-only.

## Add more prompt concepts

Edit `src/data/prompts.json`. Each entry stores art-direction components rather than a single giant prompt:

- category/product fit
- objective
- visual concept
- style tags
- composition
- lighting
- camera
- background/set
- effects
- copy zone
- negative constraints
- model hints
- quality score

This makes the library easier to search, rank and remix than storing raw text blobs only.

## Next production upgrades

- Move corpus to Postgres/Supabase with pgvector or another vector index.
- Add admin CRUD + version history for prompt templates.
- Add creative-performance fields (CTR, CPC, CPA, ROAS) and re-rank using real ad results.
- Add an embedding layer for semantic search.
- Add tenant/private libraries.
- Add OAuth for published MCP apps.

## License

Project scaffold: use/modify privately as needed. Prompt seed data in this project is original starter content and not copied verbatim from third-party prompt repositories.
