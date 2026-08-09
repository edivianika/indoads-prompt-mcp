import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { buildMcpServer } from './mcp.js';
import {
  composePrompt,
  generateAdPrompt,
  getPrompt,
  listTaxonomy,
  recommendPrompts,
  searchPrompts,
  toPublicPromptError,
} from './lib/engine.js';

export const app = express();
const port = Number(process.env.PORT || 3000);
app.use(express.json({ limit: '1mb' }));

function optionalBearer(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INDOADS_API_KEY?.trim();
  if (!expected) return next();
  const auth = req.header('authorization');
  if (auth !== `Bearer ${expected}`) {
    return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Unauthorized' });
  }
  next();
}

function errorStatus(error: unknown) {
  const payload = toPublicPromptError(error);
  if (payload.code === 'PROMPT_NOT_FOUND') return 404;
  if (payload.code === 'DATA_UNAVAILABLE') return 503;
  if (payload.code === 'UNEXPECTED_ERROR') return 500;
  return 400;
}

function sendPromptError(res: Response, error: unknown) {
  return res.status(errorStatus(error)).json(toPublicPromptError(error));
}

app.get('/health', (_req, res) => {
  try {
    res.json({ ok: true, service: 'indoads-prompt-mcp', version: '0.3.0', prompts: listTaxonomy().promptCount });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: 'indoads-prompt-mcp',
      version: '0.3.0',
      ...toPublicPromptError(error),
    });
  }
});

app.get('/privacy', (_req, res) => {
  res.type('text/plain').send(
    'IndoAds Prompt MCP is a read-only prompt retrieval service. By default it does not persist user prompts, uploaded images, or request bodies. Deployment operators are responsible for infrastructure logs and any authentication configuration.',
  );
});

app.get('/openapi.yaml', (_req, res) => {
  try {
    const text = readFileSync(fileURLToPath(new URL('../openapi.yaml', import.meta.url)), 'utf8');
    return res
      .type('application/yaml')
      .send(text.replaceAll('https://YOUR_DOMAIN', process.env.PUBLIC_BASE_URL || 'http://localhost:3000'));
  } catch {
    return res.status(503).json({ code: 'OPENAPI_UNAVAILABLE', error: 'OpenAPI schema is unavailable.' });
  }
});

app.get('/api/taxonomy', optionalBearer, (_req, res) => {
  try {
    return res.json(listTaxonomy());
  } catch (error) {
    return sendPromptError(res, error);
  }
});

app.post('/api/search', optionalBearer, (req, res) => {
  try {
    return res.json(searchPrompts(req.body ?? {}));
  } catch (error) {
    return sendPromptError(res, error);
  }
});

app.post('/api/recommend', optionalBearer, (req, res) => {
  try {
    return res.json(recommendPrompts(req.body ?? {}));
  } catch (error) {
    return sendPromptError(res, error);
  }
});

app.post('/api/generate', optionalBearer, (req, res) => {
  try {
    return res.json(generateAdPrompt(req.body ?? {}));
  } catch (error) {
    return sendPromptError(res, error);
  }
});

app.get('/api/prompts/:id', optionalBearer, (req, res) => {
  try {
    const prompt = getPrompt(String(req.params.id));
    if (!prompt) return res.status(404).json({ code: 'PROMPT_NOT_FOUND', error: 'Prompt not found' });
    return res.json(prompt);
  } catch (error) {
    return sendPromptError(res, error);
  }
});

app.post('/api/compose', optionalBearer, (req, res) => {
  try {
    return res.json(composePrompt(req.body));
  } catch (error) {
    return sendPromptError(res, error);
  }
});

const nodeMcpHandler = toNodeHandler(createMcpHandler(buildMcpServer));
app.all('/mcp', optionalBearer, (req, res) => void nodeMcpHandler(req, res, req.body));

app.get('/', (_req, res) => {
  res.json({
    name: 'IndoAds Prompt MCP',
    purpose: 'Retrieve, select and compose high-quality advertising prompts. No image generation.',
    preferredDirectWorkflow: '/api/generate or MCP tool generateAdPrompt',
    endpoints: [
      '/mcp',
      '/api/generate',
      '/api/search',
      '/api/recommend',
      '/api/compose',
      '/api/taxonomy',
      '/openapi.yaml',
      '/privacy',
    ],
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    return res.status(400).json({ code: 'INVALID_JSON', error: 'Request body must be valid JSON.' });
  }
  console.error('Unhandled request error:', error instanceof Error ? error.message : error);
  return res.status(500).json({ code: 'INTERNAL_ERROR', error: 'Internal server error.' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`IndoAds Prompt MCP listening on :${port}`);
  });
}
