import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  ComposeInput,
  GenerateAdPromptInput,
  GenerateAdPromptResult,
  PromptTemplate,
  SearchInput,
  SearchResult,
} from '../types.js';

const dataPath = fileURLToPath(new URL('../data/prompts.json', import.meta.url));

export class PromptEngineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PromptEngineError';
  }
}

let prompts: PromptTemplate[] = [];
let promptLoadError: string | undefined;

try {
  const parsed = JSON.parse(readFileSync(dataPath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Prompt database root must be an array.');
  prompts = parsed as PromptTemplate[];
} catch (error) {
  promptLoadError = 'Prompt database is unavailable.';
  console.error('Failed to load prompt database:', error instanceof Error ? error.message : 'Unknown error');
}

function assertPromptDatabase() {
  if (promptLoadError || prompts.length === 0) {
    throw new PromptEngineError('DATA_UNAVAILABLE', promptLoadError ?? 'Prompt database is empty.');
  }
}

export function toPublicPromptError(error: unknown) {
  if (error instanceof PromptEngineError) {
    return { code: error.code, error: error.message };
  }
  return { code: 'UNEXPECTED_ERROR', error: 'Unexpected prompt engine error.' };
}

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
    p.sceneDirection,
    p.composition,
    p.lighting,
    p.camera,
    p.background,
    p.effects,
    p.copyZone,
    ...p.avoid,
  ]
    .join(' ')
    .toLowerCase();
}

function contextText(input: SearchInput) {
  return [input.query, input.productDescription, input.keyBenefit, input.targetAudience].filter(Boolean).join(' ');
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

  const qTokens = tokens(contextText(input));
  if (qTokens.length) {
    const hay = searchableText(p);
    const matched = qTokens.filter((t) => hay.includes(t));
    const queryScore = Math.min(10, matched.length * 1.6);
    score += queryScore;
    if (matched.length) reasons.push(`context:${matched.slice(0, 5).join(',')}`);
  }

  return { score, reasons };
}

export function searchPrompts(input: SearchInput = {}): SearchResult[] {
  assertPromptDatabase();
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

export function recommendPrompts(input: SearchInput = {}): SearchResult[] {
  return searchPrompts({ ...input, diversify: input.diversify ?? true });
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
  assertPromptDatabase();
  return prompts.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

export function listTaxonomy() {
  assertPromptDatabase();
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
  if (!p) throw new PromptEngineError('PROMPT_NOT_FOUND', `Prompt ID not found: ${input.promptId}`);

  const ratio = input.aspectRatio || p.aspectRatios[0] || '4:5';
  const platform = input.platform || p.platforms[0] || 'social media';
  const referenceLock = input.hasReferenceImage
    ? `REFERENCE PRODUCT FIDELITY: Use the uploaded/reference product as the exact hero object. Preserve packaging shape, proportions, cap/lid, label layout, logo, brand colors and every legible printed element. Do not redesign, rename or hallucinate packaging details.`
    : `PRODUCT FIDELITY: Keep the product physically plausible and commercially believable. Do not invent extra logos, fake certifications or unreadable pseudo-text.`;

  const copyBlock = input.copyText?.trim()
    ? `AD COPY: Render only this supplied copy when text is appropriate: “${input.copyText.trim()}”. Keep spelling exact, hierarchy clean and typography secondary to the product.`
    : `AD COPY: Do not invent promotional claims. Reserve the copy area for later layout unless a minimal brand-safe headline is explicitly requested.`;
  const mediaType = input.mediaType ?? 'image';
  const duration = Math.max(5, Math.min(input.duration ?? 10, 15));
  const motionBlock = mediaType === 'motion'
    ? `MOTION DIRECTION: Create a ${duration}-second premium advertising video. Preserve exact product identity across every frame. Use smooth motivated camera movement, physically plausible product action, continuous lighting and reflections, a clear opening hook, one benefit-focused middle action, and a stable hero packshot with the supplied copy at the end. No morphing, teleportation, duplicate products, warped labels or random text.`
    : '';

  const prompt = [
    `Create a premium commercial advertising image for ${input.productName}${input.brandName ? ` by ${input.brandName}` : ''}.`,
    input.productDescription ? `PRODUCT DESCRIPTION: ${input.productDescription}` : '',
    input.keyBenefit ? `KEY BENEFIT TO COMMUNICATE VISUALLY: ${input.keyBenefit}` : '',
    input.targetAudience ? `TARGET AUDIENCE: ${input.targetAudience}` : '',
    `PRODUCT UNDERSTANDING: ${describeProduct(analyzeProduct(input.productDescription, input.keyBenefit, input.targetAudience, input.extraInstructions), input.keyBenefit, input.targetAudience)}`,
    referenceLock,
    `CONCEPT: ${p.visualConcept}. ${p.sceneDirection}`,
    `COMPOSITION: ${p.composition}`,
    `LIGHTING: ${p.lighting}`,
    `CAMERA & IMAGE CHARACTER: ${p.camera}`,
    `BACKGROUND / SET: ${p.background}`,
    `VISUAL EFFECTS: ${p.effects}`,
    `LAYOUT / COPY ZONE: ${p.copyZone}`,
    copyBlock,
    motionBlock,
    `FORMAT: ${ratio}. Design specifically for ${platform}. Keep the hero product immediately readable at thumbnail size.`,
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
    platform,
    prompt,
    mediaType,
    ...(mediaType === 'motion' ? { duration } : {}),
  };
}

function analyzeProduct(description?: string, benefit?: string, audience?: string, extra?: string) {
  const text = norm([description, benefit, audience, extra].filter(Boolean).join(' '));
  return {
    packageType: /pouch|sachet|packet/.test(text) ? 'flexible pouch or sachet' : /dropper|vial/.test(text) ? 'precision dropper or vial' : /jar|cream/.test(text) ? 'wide-mouth jar' : /bottle|serum|drink|sambal/.test(text) ? 'hero bottle' : /can|tin/.test(text) ? 'metal can or tin' : 'the exact package form described by the user',
    material: /glass|bottle|jar|dropper|vial/.test(text) ? 'rigid glass with believable weight and controlled highlights' : /metal|aluminium|aluminum|tin|can/.test(text) ? 'physically correct metal with controlled reflections' : /pouch|sachet|packet|bag/.test(text) ? 'flexible packaging with realistic folds and seams' : 'the real-world material described by the user',
    useContext: /food|snack|meal|sambal|spicy|beverage|coffee|juice/.test(text) ? 'a believable serving or consumption moment' : /skin|beauty|cosmetic|face|hair/.test(text) ? 'a refined beauty or self-care moment' : /tech|headset|keyboard|mouse|phone|laptop/.test(text) ? 'a purposeful lifestyle or functional use moment' : 'a believable moment of use inferred from the product description',
    visualMood: /premium|luxury|elegant/.test(text) ? 'restrained, premium and tactile' : /organic|natural|herbal|eco/.test(text) ? 'natural, honest and warm' : /spicy|bold|energy|sport/.test(text) ? 'dynamic, high-contrast and energetic' : 'clear, commercially appealing and product-led',
  };
}

function describeProduct(analysis: ReturnType<typeof analyzeProduct>, benefit?: string, audience?: string) {
  return [`Package: ${analysis.packageType}. Material: ${analysis.material}. Use context: ${analysis.useContext}. Visual mood: ${analysis.visualMood}.`, benefit ? `Make this benefit visually understandable without inventing unsupported claims: ${benefit.trim()}.` : 'Do not invent unsupported product claims.', audience ? `Tune styling and emotional tone to this audience: ${audience.trim()}.` : ''].filter(Boolean).join(' ');
}

function hasGenerateContext(input: GenerateAdPromptInput) {
  return [
    input.query,
    input.category,
    input.productType,
    input.productName,
    input.brandName,
    input.productDescription,
    input.keyBenefit,
    input.targetAudience,
    input.objective,
    input.style,
  ].some((value) => Boolean(value?.trim()));
}

export function generateAdPrompt(input: GenerateAdPromptInput = {}): GenerateAdPromptResult {
  if (!hasGenerateContext(input)) {
    throw new PromptEngineError(
      'INVALID_INPUT',
      'Provide at least one product or advertising detail such as productName, productDescription, productType, category, query, objective, or style.',
    );
  }

  const [best] = recommendPrompts({
    query: input.query,
    category: input.category,
    productType: input.productType,
    productDescription: input.productDescription,
    keyBenefit: input.keyBenefit,
    targetAudience: input.targetAudience,
    objective: input.objective,
    style: input.style,
    platform: input.platform,
    aspectRatio: input.aspectRatio,
    count: 1,
    diversify: false,
  });

  if (!best) {
    throw new PromptEngineError('NO_PROMPT_MATCH', 'No suitable advertising concept was found for the provided input.');
  }

  const selected = getPrompt(best.id);
  if (!selected) {
    throw new PromptEngineError('DATA_INTEGRITY_ERROR', 'The selected advertising concept could not be loaded.');
  }

  const productName =
    input.productName?.trim() || input.brandName?.trim() || input.productType?.trim() || 'the advertised product';

  const composed = composePrompt({
    promptId: selected.id,
    productName,
    brandName: input.brandName,
    productDescription: input.productDescription,
    keyBenefit: input.keyBenefit,
    targetAudience: input.targetAudience,
    copyText: input.copyText,
    platform: input.platform,
    aspectRatio: input.aspectRatio,
    hasReferenceImage: input.hasReferenceImage,
    extraInstructions: input.extraInstructions,
    mediaType: input.mediaType,
    duration: input.duration,
    videoModel: input.videoModel,
  });
  const analysis = analyzeProduct(input.productDescription, input.keyBenefit, input.targetAudience, input.extraInstructions);

  return {
    prompt: composed.prompt,
    concept: {
      id: selected.id,
      name: selected.title,
      visualConcept: selected.visualConcept,
      style: input.style?.trim() || selected.styleTags[0] || 'commercial',
      styleTags: selected.styleTags,
      objective: input.objective?.trim() || selected.objectives[0] || 'advertising',
      matchScore: best.score,
      matchReasons: best.matchReasons,
    },
    aspectRatio: composed.aspectRatio,
    platform: composed.platform,
    recommendedModels: composed.recommendedModels,
    mediaType: composed.mediaType,
    ...(composed.mediaType === 'motion' ? {
      duration: composed.duration,
      storyboard: [
        { time: '0–2s', shot: 'Immediate visual hook: reveal the product and establish the setting with a purposeful camera move.', audio: 'Subtle opening impact and ambience.' },
        { time: `${Math.max(2, Math.round((composed.duration ?? 10) * 0.2))}–${Math.max(4, Math.round((composed.duration ?? 10) * 0.6))}s`, shot: 'Show the product in use or visualize its primary benefit with one clear, physically plausible action.', audio: 'Product-use sound and restrained musical lift.' },
        { time: `${Math.max(4, Math.round((composed.duration ?? 10) * 0.6))}–${composed.duration ?? 10}s`, shot: 'Resolve into a stable hero packshot, logo facing camera, with supplied copy and a CTA-safe area.', audio: 'Clean branded resolve and soft CTA accent.' },
      ],
    } : {}),
    productAnalysis: analysis,
  };
}
