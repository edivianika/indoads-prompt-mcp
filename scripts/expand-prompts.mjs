import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const base = JSON.parse(readFileSync('src/data/prompts.json', 'utf8'));
const seeds = JSON.parse(readFileSync('src/data/prompt-seeds-v2.json', 'utf8'));

const categoryDefaults = {
  general: {
    productTypes: ['packaged product', 'consumer goods', 'premium product'],
    objectives: ['conversion', 'brand awareness'],
    avoid: ['generic AI look', 'random decorative objects', 'warped packaging', 'unreadable pseudo-text'],
  },
  fnb: {
    productTypes: ['food product', 'beverage', 'snack', 'sauce', 'packaged food'],
    objectives: ['conversion', 'appetite appeal'],
    avoid: ['inedible-looking food', 'irrelevant ingredients', 'plastic-looking texture', 'messy garnish', 'fake steam'],
  },
  beauty: {
    productTypes: ['skincare', 'cosmetic', 'serum', 'cream', 'beauty product'],
    objectives: ['premium positioning', 'consideration', 'conversion'],
    avoid: ['plastic skin', 'medical claims', 'over-retouched texture', 'random flowers', 'warped bottle or label'],
  },
  fashion: {
    productTypes: ['footwear', 'fashion accessory', 'apparel', 'bag', 'watch'],
    objectives: ['brand awareness', 'premium positioning', 'conversion'],
    avoid: ['deformed product geometry', 'extra laces or straps', 'fake logos', 'awkward anatomy', 'cheap catalog look'],
  },
  tech: {
    productTypes: ['electronics', 'tech accessory', 'gadget', 'gaming accessory', 'device'],
    objectives: ['launch', 'consideration', 'conversion'],
    avoid: ['impossible ports', 'fake UI text', 'random LEDs', 'warped geometry', 'overdone sci-fi clutter'],
  },
  home: {
    productTypes: ['home product', 'furniture', 'decor', 'kitchenware', 'appliance'],
    objectives: ['consideration', 'conversion', 'lifestyle positioning'],
    avoid: ['impossible architecture', 'floating furniture', 'clutter', 'wrong scale', 'over-staged showroom look'],
  },
  property: {
    productTypes: ['house', 'villa', 'residential property', 'apartment', 'real estate'],
    objectives: ['lead generation', 'consideration', 'premium positioning'],
    avoid: ['impossible architecture', 'duplicate windows', 'fantasy landscaping', 'fisheye distortion', 'fake signage'],
  },
  automotive: {
    productTypes: ['car', 'motorcycle', 'automotive product', 'vehicle', 'auto accessory'],
    objectives: ['brand awareness', 'consideration', 'conversion'],
    avoid: ['warped wheels', 'duplicate lights', 'impossible reflections', 'fake badges', 'exaggerated motion blur'],
  },
};

const platforms = ['Instagram', 'Facebook', 'Marketplace', 'Website'];
const aspectRatios = ['4:5', '1:1', '9:16'];
const modelHints = ['GPT Image', 'Nano Banana', 'Seedream', 'Flux'];

function artDirection(category, title, concept, tags) {
  const t = [...tags, title, concept].join(' ').toLowerCase();
  const macro = /macro|detail|texture|craft/.test(t);
  const top = /top view|top-down|flatlay|overhead/.test(t);
  const dark = /dark|night|midnight|black|neon/.test(t);
  const dynamic = /dynamic|motion|splash|orbit|explosion|speed|drive|trail/.test(t);
  const lifestyle = /lifestyle|family|ritual|morning|travel|street|workspace|room|kitchen|table|outdoor/.test(t);
  const clean = /clean|minimal|clinical|marketplace|ecommerce|white|precision/.test(t);
  const luxury = /luxury|premium|editorial|quiet/.test(t);

  const lighting = dark
    ? 'Low-key motivated lighting with a precise hero key, controlled rim highlights and believable shadow direction.'
    : clean
      ? 'Large diffused commercial key with clean edge separation, accurate material response and controlled highlights.'
      : dynamic
        ? 'Crisp directional commercial lighting that freezes motion while keeping the hero readable and dimensional.'
        : luxury
          ? 'Soft directional premium lighting with elegant falloff, restrained specular highlights and realistic contact shadows.'
          : 'Natural-looking commercial light with clear hierarchy, realistic shadows and faithful product color.';

  const camera = top
    ? 'True overhead commercial perspective, corrected geometry, intentional spacing and edge-to-edge sharpness where needed.'
    : macro
      ? '85-100mm macro-commercial character, precise focal plane, tactile micro-detail and controlled depth falloff.'
      : lifestyle
        ? '35-50mm environmental commercial perspective with natural scale, believable depth and no wide-angle distortion.'
        : '70-100mm commercial product perspective with minimal distortion, crisp hero detail and refined depth.';

  const composition = top
    ? 'Structured overhead layout with a dominant hero, disciplined supporting elements and a clearly reserved copy zone.'
    : dynamic
      ? 'Strong directional flow around a sharp, unobstructed hero; supporting motion must never cover branding or key geometry.'
      : lifestyle
        ? 'Hero remains the primary focal point inside a believable use context; secondary elements provide scale and story without clutter.'
        : 'Clear hero hierarchy, generous negative space and deliberate geometric balance suitable for premium advertising.';

  const background = dark
    ? 'Deep controlled environment with restrained practicals, tonal separation and no generic cyberpunk clutter.'
    : clean
      ? 'Minimal seamless, architectural or contextual background with clean negative space and brand-compatible tones.'
      : lifestyle
        ? 'Believable contextual environment selected for the real use case, art-directed but not over-staged.'
        : 'Premium studio or contextual set using restrained materials and brand-compatible color relationships.';

  const effects = dynamic
    ? 'Use only physically plausible motion cues, droplets, particles, reflections or atmosphere that directly support the concept.'
    : 'Keep effects restrained and physically plausible; material, light, shadow and composition should carry the image.';

  return {
    sceneDirection: `Execute “${concept}” as a polished agency-level ${category} advertising concept. Make the visual idea immediately readable at thumbnail size, keep the hero exact and believable, and avoid decorative AI gimmicks.`,
    composition,
    lighting,
    camera,
    background,
    effects,
    copyZone: 'Reserve one calm high-contrast region for a short headline and CTA without reducing hero readability.',
  };
}

const additions = seeds.map(([id, category, title, visualConcept, styleTags, qualityScore]) => {
  const defaults = categoryDefaults[category];
  if (!defaults) throw new Error(`Unknown prompt category: ${category}`);
  return {
    id,
    title,
    categories: [category],
    productTypes: defaults.productTypes,
    objectives: defaults.objectives,
    visualConcept,
    styleTags,
    platforms,
    aspectRatios,
    modelHints,
    qualityScore,
    ...artDirection(category, title, visualConcept, styleTags),
    avoid: defaults.avoid,
  };
});

// Safe on repeated service restarts: strip any v2 IDs before re-merging.
const seedIds = new Set(seeds.map(([id]) => id));
const cleanBase = base.filter((prompt) => !seedIds.has(prompt.id));
const merged = [...cleanBase, ...additions];
const ids = new Set(merged.map((prompt) => prompt.id));
if (merged.length !== 200 || ids.size !== 200) {
  throw new Error(`Expected 200 unique prompts, got ${merged.length} prompts / ${ids.size} unique IDs`);
}

mkdirSync('dist/data', { recursive: true });
const payload = `${JSON.stringify(merged, null, 2)}\n`;
writeFileSync('dist/data/prompts.json', payload);
if (process.argv.includes('--runtime')) {
  writeFileSync('src/data/prompts.json', payload);
}
console.log(`Expanded IndoAds prompt library: ${cleanBase.length} + ${additions.length} = ${merged.length}`);
