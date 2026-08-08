import { readFileSync } from 'node:fs';

const prompts = JSON.parse(readFileSync(new URL('./src/data/prompts.json', import.meta.url), 'utf8'));
const required = [
  'id','title','categories','productTypes','objectives','visualConcept','styleTags','platforms','aspectRatios',
  'modelHints','qualityScore','sceneDirection','composition','lighting','camera','background','effects','copyZone','avoid'
];

const ids = new Set();
for (const [index, p] of prompts.entries()) {
  for (const key of required) {
    if (!(key in p)) throw new Error(`Prompt #${index} (${p.id ?? '?'}) missing ${key}`);
  }
  if (ids.has(p.id)) throw new Error(`Duplicate ID: ${p.id}`);
  ids.add(p.id);
  if (p.qualityScore < 0 || p.qualityScore > 10) throw new Error(`Invalid qualityScore: ${p.id}`);
}
console.log(`OK: ${prompts.length} prompt templates, all IDs unique.`);
