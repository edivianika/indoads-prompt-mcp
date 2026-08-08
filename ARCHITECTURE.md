# IndoAds Prompt Engine Architecture

## MVP

ChatGPT / Custom GPT
→ product-image understanding happens in ChatGPT
→ `recommend` tool sends structured brief to IndoAds
→ lexical + metadata ranking over curated prompt corpus
→ diversity pass
→ user chooses concept
→ `compose` tool assembles final prompt + product-fidelity constraints
→ ChatGPT returns prompt or hands it to an image generator

## Why the server does not need the uploaded image

The image remains in the ChatGPT conversation. ChatGPT's vision capability converts it into a concise structured `productDescription`. The prompt server only needs that description for retrieval. This keeps the service simple, private, cheap and model-agnostic.

## Data model

Each concept is stored as structured art direction rather than a giant prompt blob:
- categories / product types / objectives
- visual concept
- style tags / target platforms / ratios / model hints
- scene direction
- composition
- lighting
- camera
- background
- effects
- copy zone
- avoid list
- quality score

## Phase 2

Replace JSON with Postgres/Supabase tables:
- `prompt_templates`
- `prompt_versions`
- `prompt_tags`
- `creative_performance`
- `tenant_libraries`

Add embeddings for semantic retrieval, but keep metadata scoring as a controllable re-ranking layer.

## Phase 3: performance-aware prompt intelligence

Store outcomes for each generated creative:
- prompt/template ID
- product/category
- platform/placement
- spend, impressions, CTR, CPC, CPA, CVR, ROAS
- human rating / approval

Then compute category-specific prior scores. Search ranking becomes:

`semantic relevance + metadata fit + quality score + diversity + observed creative performance`

This turns the library from a prompt collection into a learning creative system.
