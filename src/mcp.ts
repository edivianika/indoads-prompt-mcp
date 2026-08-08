import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { composePrompt, getPrompt, listTaxonomy, searchPrompts } from './lib/engine.js';

const jsonText = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

export function buildMcpServer() {
  const server = new McpServer(
    { name: 'indoads-prompt-mcp', version: '0.1.0' },
    {
      instructions:
        'Use this server as an advertising prompt retrieval engine. When a user provides or uploads a product, first infer category, product type, objective, visual mood, target platform and ratio. Call recommend_ad_prompts or search_ad_prompts, present diverse concepts, then call compose_ad_prompt for the selected concept. Do not claim the MCP generated an image; it returns prompts only.',
    },
  );

  const searchSchema = z.object({
    query: z.string().optional().describe('Natural language need, e.g. premium spicy sambal ad'),
    category: z.string().optional(),
    productType: z.string().optional(),
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
      description: 'Search and rank advertising prompt concepts from the curated IndoAds prompt library.',
      inputSchema: searchSchema,
    },
    async (input) => jsonText(searchPrompts(input)),
  );

  server.registerTool(
    'recommend_ad_prompts',
    {
      description:
        'Recommend diverse ad concepts for a product. Best first tool after ChatGPT analyzes an uploaded product image.',
      inputSchema: searchSchema.extend({
        productDescription: z.string().optional().describe('Visual/product details inferred from the uploaded image'),
      }),
    },
    async ({ productDescription, ...input }) =>
      jsonText(
        searchPrompts({
          ...input,
          query: [input.query, productDescription].filter(Boolean).join(' '),
          diversify: input.diversify ?? true,
        }),
      ),
  );

  server.registerTool(
    'get_ad_prompt',
    {
      description: 'Fetch one full prompt-template record by ID.',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      const prompt = getPrompt(id);
      return prompt ? jsonText(prompt) : { ...jsonText({ error: `Prompt not found: ${id}` }), isError: true };
    },
  );

  server.registerTool(
    'compose_ad_prompt',
    {
      description:
        'Turn a selected prompt concept into a final image-generation prompt customized to the user product. This does not generate the image.',
      inputSchema: z.object({
        promptId: z.string(),
        productName: z.string(),
        brandName: z.string().optional(),
        productDescription: z.string().optional(),
        keyBenefit: z.string().optional(),
        targetAudience: z.string().optional(),
        copyText: z.string().optional(),
        aspectRatio: z.string().optional(),
        hasReferenceImage: z.boolean().optional(),
        extraInstructions: z.string().optional(),
      }),
    },
    async (input) => {
      try {
        return jsonText(composePrompt(input));
      } catch (error) {
        return { ...jsonText({ error: error instanceof Error ? error.message : String(error) }), isError: true };
      }
    },
  );

  server.registerTool(
    'list_prompt_taxonomy',
    {
      description: 'List available categories, styles, product types, objectives, ratios, platforms and model hints.',
      inputSchema: z.object({}),
    },
    async () => jsonText(listTaxonomy()),
  );

  return server;
}
