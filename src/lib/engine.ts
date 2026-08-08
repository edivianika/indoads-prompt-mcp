import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ComposeInput, PromptTemplate, SearchInput, SearchResult } from '../types.js';

const dataPath = fileURLToPath(new URL('../data/prompts.json', import.meta.url));
const prompts = JSON.parse(readFileSync(dataPath, 'utf8')) as PromptTemplate[];

const norm = (v?: string) => (v ?? '').toLowerCase().trim();
const tokens = (v?: string) =>
  norm(v)
    .split(/[^a-z0-9]+/i)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);

const synonymGroups = [
  ['sambal', 'hot sauce', 'chili sauce', 'sauce', 'condiment'],
  ['drink', 'beverage', 'juice', 'bottled beverage', 'coffee drink'],
  ['serum', 'skincare', 'skin care', 'cosmetic'],
  ['shoe', 'sneaker', 'footwear'],
  ['bag', 'leather goods', 'fashion accessory'],
  ['headset', 'headphone', 'audio accessory', 'gaming accessory'],
  ['mouse', 'keyboard', 'peripheral', 'tech accessory', 'gaming accessory'],
  ['house', 'home', 'residential property', 'villa'],
  ['packaged product', 'consumer goods', 'retail product'],
];

const equivalents = (value?: string) => {
  const needle = norm(value);
  if (!needle) return [];
  const group = synonymGroups.find((g) => g.some((item) => item === needle || item.includes(needle) || needle.includes(item)));
  return group ? [...new Set([needle, ...group])] : [needle];
};

const includesLoose = (items: string[], value?: string) => {
  const needles = equivalents(value);
  if (!needles.length) return false;
  return items.some((item) => {
    const hay = norm(item);
    return needles.some((needle) => hay === needle || hay.includes(needle) || needle.includes(hay));
  });
};

function searchableText(p: PromptTemplate) {
  return [
    p.id,
    p.title,
    ...p.categories,
    ...p.productTypes,
    ...p.objectives,
    p.visualConcept,
    ...p.styleTags,
    ...p.platforms,
    ...p.aspectRatios,
    ...p.modelHints,
  ]
    .join(' ')
    .toLowerCase();
}

function scorePrompt(p: PromptTemplate, input: SearchInput): { score: number; reasons: string[] } {
  let score = p.qualityScore * 0.35;
  const reasons: string[] = [`quality ${p.qualityScore.toFixed(1)}/10`];

  if (input.category) {
    if (includesLoose(p.categories, input.category)) {
      score += 9;
      reasons.push(`category:${input.category}`);
    } else {
      score -= 4;
    }
  }
  if (input.productType) {
    if (includesLoose(p.productTypes, input.productType)) {
      score += 7;
      reasons.push(`product:${input.productType}`);
    } else {
      score -= 3;
    }
  }
  if (input.objective) {
    if (includesLoose(p.objectives, input.objective)) {
      score += 6;
      reasons.push(`objective:${input.objective}`);
    } else {
      score -= 1;
    }
  }
  if (input.style && includesLoose(p.styleTags, input.style)) {
    score += 4;
    reasons.push(`style:${input.style}`);
  }
  if (input.platform && includesLoose(p.platforms, input.platform)) {
    score += 2.5;
    reasons.push(`platform:${input.platform}`);
  }
  if (input.aspectRatio && includesLoose(p.aspectRatios, input.aspectRatio)) {
    score += 2.5;
    reasons.push(`ratio:${input.aspectRatio}`);
  }
  if (input.model && includesLoose(p.modelHints, input.model)) {
    score += 1.5;
    reasons.push(`model:${input.model}`);
  }

  const qTokens = tokens(input.query);
  if (qTokens.length) {
    const hay = searchableText(p);
    const matched = qTokens.filter((t) => hay.includes(t));
    const queryScore = Math.min(10, matched.length * 1.6);
    score += queryScore;
    if (matched.length) reasons.push(`query:${matched.slice(0, 5).join(',')}`);
  }

  return { score, reasons };
}

export function searchPrompts(input: SearchInput = {}): SearchResult[] {
  const count = Math.max(1, Math.min(input.count ?? 8, 20));
  const ranked = prompts
    .map((p) => {
      const { score, reasons } = scorePrompt(p, input);
      return { p, score, reasons };
    })
    .sort((a, b) => b.score - a.score || b.p.qualityScore - a.p.qualityScore);

  if (input.diversify === false) {
    return ranked.slice(0, count).map(toResult);
  }

  const selected: typeof ranked = [];
  const remaining = [...ranked];

  while (selected.length < count && remaining.length) {
    let bestIndex = 0;
    let bestAdjusted = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const conceptKey = norm(candidate.p.visualConcept);
      const primaryStyle = norm(candidate.p.styleTags[0]);
      const conceptMatches = selected.filter((s) => norm(s.p.visualConcept) === conceptKey).length;
      const styleMatches = selected.filter((s) => norm(s.p.styleTags[0]) === primaryStyle).length;
      const adjusted = candidate.score - conceptMatches * 5 - styleMatches * 1.5;

      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIndex = i;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]!);
  }

  return selected.map(toResult);
}

function toResult(x: { p: PromptTemplate; score: number; reasons: string[] }): SearchResult {
  return {
    id: x.p.id,
    title: x.p.title,
    visualConcept: x.p.visualConcept,
    score: Number(x.score.toFixed(2)),
    matchReasons: x.reasons,
    categories: x.p.categories,
    styleTags: x.p.styleTags,
    productTypes: x.p.productTypes,
    aspectRatios: x.p.aspectRatios,
    qualityScore: x.p.qualityScore,
  };
}

export function getPrompt(id: string): PromptTemplate | undefined {
  return prompts.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

export function listTaxonomy() {
  const unique = (fn: (p: PromptTemplate) => string[]) => [...new Set(prompts.flatMap(fn))].sort();
  return {
    promptCount: prompts.length,
    categories: unique((p) => p.categories),
    productTypes: unique((p) => p.productTypes),
    objectives: unique((p) => p.objectives),
    styleTags: unique((p) => p.styleTags),
    platforms: unique((p) => p.platforms),
    aspectRatios: unique((p) => p.aspectRatios),
    modelHints: unique((p) => p.modelHints),
  };
}

export function composePrompt(input: ComposeInput) {
  const p = getPrompt(input.promptId);
  if (!p) throw new Error(`Prompt ID not found: ${input.promptId}`);

  const ratio = input.aspectRatio || p.aspectRatios[0] || '4:5';
  const referenceLock = input.hasReferenceImage
    ? `REFERENCE PRODUCT FIDELITY: Use the uploaded/reference product as the exact hero object. Preserve packaging shape, proportions, cap/lid, label layout, logo, brand colors and every legible printed element. Do not redesign, rename or hallucinate packaging details.`
    : `PRODUCT FIDELITY: Keep the product physically plausible and commercially believable. Do not invent extra logos, fake certifications or unreadable pseudo-text.`;

  const copyBlock = input.copyText?.trim()
    ? `AD COPY: Render only this supplied copy when text is appropriate: “${input.copyText.trim()}”. Keep spelling exact, hierarchy clean and typography secondary to the product.`
    : `AD COPY: Do not invent promotional claims. Reserve the copy area for later layout unless a minimal brand-safe headline is explicitly requested.`;

  const prompt = [
    `Create a premium commercial advertising image for ${input.productName}${input.brandName ? ` by ${input.brandName}` : ''}.`,
    input.productDescription ? `PRODUCT DESCRIPTION: ${input.productDescription}` : '',
    input.keyBenefit ? `KEY BENEFIT TO COMMUNICATE VISUALLY: ${input.keyBenefit}` : '',
    input.targetAudience ? `TARGET AUDIENCE: ${input.targetAudience}` : '',
    referenceLock,
    `CONCEPT: ${p.visualConcept}. ${p.sceneDirection}`,
    `COMPOSITION: ${p.composition}`,
    `LIGHTING: ${p.lighting}`,
    `CAMERA & IMAGE CHARACTER: ${p.camera}`,
    `BACKGROUND / SET: ${p.background}`,
    `VISUAL EFFECTS: ${p.effects}`,
    `LAYOUT / COPY ZONE: ${p.copyZone}`,
    copyBlock,
    `FORMAT: ${ratio}. Design for ${p.platforms.join(', ')}. Keep the hero product immediately readable at thumbnail size.`,
    `QUALITY BAR: polished agency-level commercial art direction, coherent shadows and reflections, realistic materials, controlled depth, premium color separation, no generic AI-slop styling.`,
    `AVOID: ${p.avoid.join('; ')}; distorted packaging; duplicate products unless requested; warped logos; random text; clutter; muddy lighting; overprocessed HDR; fake UI elements; watermarks.`,
    input.extraInstructions ? `EXTRA INSTRUCTIONS: ${input.extraInstructions}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    id: p.id,
    title: p.title,
    visualConcept: p.visualConcept,
    recommendedModels: p.modelHints,
    aspectRatio: ratio,
    prompt,
  };
}
