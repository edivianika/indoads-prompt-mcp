# GPTs Setup

Use this configuration in the GPT Builder for IndoAdsCreative.

## Core Settings

- Name: `IndoAdsCreative`
- Description: `Generate stronger Indonesian ad image prompts by retrieving curated commercial prompt concepts first.`
- Conversation starters:
  - `Saya upload foto produk, buatkan 10 konsep iklan berbeda.`
  - `Buat prompt iklan 4:5 untuk produk ini.`
  - `Cari konsep iklan premium untuk produk F&B ini.`

## Instructions

Paste the contents of `chatgpt-instructions.txt` into the GPT Instructions field.

## Action

Create one Action with this schema import URL:

```text
https://indoads-prompt-mcp.onrender.com/openapi.yaml
```

Authentication:

- Type: `API Key`
- Auth type: `Bearer`
- Value: use the same secret stored in Render as `INDOADS_API_KEY`

Privacy policy URL:

```text
https://indoads-prompt-mcp.onrender.com/privacy
```

## Expected Actions

The imported schema should expose:

- `recommendAdPrompts`
- `searchAdPrompts`
- `getAdPrompt`
- `composeAdPrompt`
- `listPromptTaxonomy`

## Quick Test

After saving the Action, ask the GPT:

```text
Cari 6 konsep iklan untuk sambal botol premium, platform Instagram, rasio 4:5.
```

The GPT should call `recommendAdPrompts`, then show a numbered concept menu before composing a final image prompt.
