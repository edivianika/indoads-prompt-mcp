import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { buildMcpServer } from './mcp.js';
import { composePrompt, getPrompt, listTaxonomy, searchPrompts } from './lib/engine.js';

const app = express();
const port = Number(process.env.PORT || 3000);
app.use(express.json({ limit: '1mb' }));

function optionalBearer(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INDOADS_API_KEY?.trim();
  if (!expected) return next();
  const auth = req.header('authorization');
  if (auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'indoads-prompt-mcp', version: '0.1.0', prompts: listTaxonomy().promptCount });
});

app.get('/privacy', (_req, res) => {
  res.type('text/plain').send(
    'IndoAds Prompt MCP is a read-only prompt retrieval service. By default it does not persist user prompts, uploaded images, or request bodies. Deployment operators are responsible for infrastructure logs and any authentication configuration.',
  );
});

app.get('/openapi.yaml', (_req, res) => {
  const text = readFileSync(resolve(process.cwd(), 'openapi.yaml'), 'utf8');
  res.type('application/yaml').send(text.replaceAll('https://YOUR_DOMAIN', process.env.PUBLIC_BASE_URL || 'http://localhost:3000'));
});

app.get('/api/taxonomy', optionalBearer, (_req, res) => res.json(listTaxonomy()));

app.post('/api/search', optionalBearer, (req, res) => {
  res.json(searchPrompts(req.body ?? {}));
});

app.post('/api/recommend', optionalBearer, (req, res) => {
  const { productDescription, ...input } = req.body ?? {};
  res.json(
    searchPrompts({
      ...input,
      query: [input.query, productDescription].filter(Boolean).join(' '),
      diversify: input.diversify ?? true,
    }),
  );
});

app.get('/api/prompts/:id', optionalBearer, (req, res) => {
  const prompt = getPrompt(String(req.params.id));
  if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
  return res.json(prompt);
});

app.post('/api/compose', optionalBearer, (req, res) => {
  try {
    return res.json(composePrompt(req.body));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

const nodeMcpHandler = toNodeHandler(createMcpHandler(buildMcpServer));
app.all('/mcp', optionalBearer, (req, res) => void nodeMcpHandler(req, res, req.body));

app.get('/', (_req, res) => {
  res.json({
    name: 'IndoAds Prompt MCP',
    purpose: 'Retrieve and compose high-quality advertising prompts. No image generation.',
    endpoints: ['/mcp', '/api/search', '/api/recommend', '/api/compose', '/api/taxonomy', '/openapi.yaml'],
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`IndoAds Prompt MCP listening on :${port}`);
});
