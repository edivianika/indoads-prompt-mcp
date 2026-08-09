import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  composePrompt,
  generateAdPrompt,
  getPrompt,
  listTaxonomy,
  recommendPrompts,
  searchPrompts,
  toPublicPromptError,
} from './lib/engine.js';

const jsonText = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const toolError = (error: unknown) => ({ ...jsonText(toPublicPromptError(error)), isError: true });

export function buildMcpServer() {
  const server = new McpServer(
    { name: 'indoads-prompt-mcp', version: '0.3.0' },
    {
      instructions:
        'Use generateAdPrompt as the default tool when the user wants a finished advertising visual prompt in one step. It internally selects the best concept and composes the final image-generation prompt. Use recommend_ad_prompts only when the user explicitly wants multiple concept options, search_ad_prompts for browsing/search, get_ad_prompt when a specific concept ID is already known, and compose_ad_prompt only when a concept ID has already been selected. This server returns prompts only and does not generate images.',
    },
  );

  const searchSchema = z.object({
    query: z.string().optional().describe('Natural language advertising need, e.g. premium spicy sambal ad'),
    category: z.string().optional(),
    productType: z.string().optional(),
    productDescription: z.string().optional().describe('Product or visual details, including details inferred from an uploaded image'),
    keyBenefit: z.string().optional(),
    targetAudience: z.string().optional(),
    objective: z.string().optional(),
    style: z.string().optional(),
    platform: z.string().optional(),
    aspectRatio: z.string().optional(),
    model: z.string().optional(),
    count: z.number().int().min(1).max(20).optional(),
    diversify: z.boolean().optional(),
  });

  server.registerTool(
    'search_ad_prompts',
    {
      description:
        'Search or browse advertising concepts using filters and natural language. Use this when the user wants to explore the library, not when they simply want a finished ad prompt.',
      inputSchema: searchSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        return jsonText(searchPrompts(input));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'recommend_ad_prompts',
    {
      description:
        'Return multiple diverse advertising concept recommendations. Use only when the user explicitly wants options or wants to choose a concept. For a direct “make an ad” request, prefer generateAdPrompt instead.',
      inputSchema: searchSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        return jsonText(recommendPrompts(input));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_ad_prompt',
    {
      description:
        'Fetch one full prompt-template record by a known concept ID. Do not call this after generateAdPrompt; that tool already returns the final prompt and selected concept metadata.',
      inputSchema: z.object({ id: z.string() }),
      annotations: readOnlyAnnotations,
    },
    async ({ id }) => {
      try {
        const prompt = getPrompt(id);
        return prompt
          ? jsonText(prompt)
          : { ...jsonText({ code: 'PROMPT_NOT_FOUND', error: `Prompt not found: ${id}` }), isError: true };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'compose_ad_prompt',
    {
      description:
        'Compose a final image-generation prompt from a concept ID that has already been selected. Use this only when the user/model already has a specific promptId. For direct ad creation without a chosen ID, prefer generateAdPrompt.',
      inputSchema: z.object({
        promptId: z.string(),
        productName: z.string(),
        brandName: z.string().optional(),
        productDescription: z.string().optional(),
        keyBenefit: z.string().optional(),
        targetAudience: z.string().optional(),
        copyText: z.string().optional(),
        platform: z.string().optional(),
        aspectRatio: z.string().optional(),
        hasReferenceImage: z.boolean().optional(),
        extraInstructions: z.string().optional(),
        mediaType: z.enum(['image', 'motion']).optional(),
        duration: z.number().int().min(5).max(15).optional(),
        videoModel: z.string().optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        return jsonText(composePrompt(input));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'generateAdPrompt',
    {
      description:
        'Use this tool when the user wants to create an advertisement or advertising visual directly. It selects the most relevant advertising concept and returns a final image-generation prompt in a single call. Prefer this tool over chaining recommend_ad_prompts, get_ad_prompt, and compose_ad_prompt.',
      inputSchema: z.object({
        query: z.string().optional(),
        category: z.string().optional(),
        productType: z.string().optional(),
        productName: z.string().optional(),
        brandName: z.string().optional(),
        productDescription: z.string().optional(),
        keyBenefit: z.string().optional(),
        targetAudience: z.string().optional(),
        objective: z.string().optional(),
        style: z.string().optional(),
        platform: z.string().optional(),
        aspectRatio: z.string().optional(),
        copyText: z.string().optional(),
        hasReferenceImage: z.boolean().optional(),
        extraInstructions: z.string().optional(),
        mediaType: z.enum(['image', 'motion']).optional(),
        duration: z.number().int().min(5).max(15).optional(),
        videoModel: z.string().optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        return jsonText(generateAdPrompt(input));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'list_prompt_taxonomy',
    {
      description:
        'List available categories, styles, product types, objectives, ratios, platforms and model hints. Use for discovery or configuration, not for direct ad creation.',
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => {
      try {
        return jsonText(listTaxonomy());
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}
