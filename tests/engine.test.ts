import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composePrompt,
  generateAdPrompt,
  getPrompt,
  listTaxonomy,
  PromptEngineError,
  recommendPrompts,
  searchPrompts,
} from '../src/lib/engine.js';

test('corpus is loaded', () => {
  assert.ok(listTaxonomy().promptCount >= 40);
});

test('F&B search prioritizes F&B concepts', () => {
  const result = searchPrompts({ category: 'fnb', productType: 'sambal', query: 'spicy appetite', count: 5 });
  assert.equal(result.length, 5);
  assert.ok(result.some((x) => x.categories.includes('fnb')));
});

test('recommendPrompts preserves recommendation behavior', () => {
  const result = recommendPrompts({ category: 'beauty', productType: 'serum', count: 3 });
  assert.equal(result.length, 3);
  assert.ok(result.some((x) => x.categories.includes('beauty')));
});

test('prompt can be composed with reference fidelity', () => {
  const first = searchPrompts({ category: 'beauty', count: 1 })[0];
  assert.ok(first);
  const composed = composePrompt({
    promptId: first.id,
    productName: 'Serum A',
    productDescription: 'clear 30ml glass dropper bottle',
    hasReferenceImage: true,
    platform: 'Instagram',
    aspectRatio: '4:5',
  });
  assert.match(composed.prompt, /REFERENCE PRODUCT FIDELITY/);
  assert.match(composed.prompt, /4:5/);
  assert.match(composed.prompt, /Instagram/);
});

test('known IDs resolve', () => {
  assert.ok(getPrompt('FNB-001'));
});

test('generateAdPrompt selects and composes in one internal call', () => {
  const result = generateAdPrompt({
    productName: 'Lumina Serum',
    brandName: 'Lumina',
    productDescription: 'Brightening facial serum with niacinamide',
    keyBenefit: 'Brighter looking skin',
    targetAudience: 'Women 20-35',
    objective: 'conversion',
    style: 'premium',
    platform: 'Instagram',
    aspectRatio: '4:5',
    copyText: 'Glow Starts Here',
  });

  assert.ok(result.prompt.length > 200);
  assert.ok(result.concept.id);
  assert.ok(result.concept.name);
  assert.equal(result.aspectRatio, '4:5');
  assert.equal(result.platform, 'Instagram');
  assert.match(result.prompt, /Lumina Serum/);
  assert.match(result.prompt, /Glow Starts Here/);
  assert.match(result.prompt, /Women 20-35/);
});

test('generateAdPrompt works with partial input', () => {
  const result = generateAdPrompt({
    productName: 'Kopi ABC',
    productDescription: 'kopi susu premium',
    platform: 'Instagram',
    aspectRatio: '1:1',
  });

  assert.ok(result.prompt);
  assert.equal(result.aspectRatio, '1:1');
  assert.equal(result.platform, 'Instagram');
});

test('motion generation includes product-aware direction and storyboard', () => {
  const result = generateAdPrompt({
    productName: 'Sambal Nusantara',
    productDescription: 'premium sambal in a glass bottle with a red label',
    keyBenefit: 'rich smoky heat',
    mediaType: 'motion',
    duration: 10,
  });

  assert.equal(result.mediaType, 'motion');
  assert.equal(result.duration, 10);
  assert.equal(result.storyboard?.length, 3);
  assert.match(result.prompt, /MOTION DIRECTION/);
  assert.match(result.prompt, /rigid glass/);
  assert.match(result.prompt, /rich smoky heat/);
});

test('generateAdPrompt rejects an empty request with a public-safe error', () => {
  assert.throws(
    () => generateAdPrompt({}),
    (error: unknown) => error instanceof PromptEngineError && error.code === 'INVALID_INPUT',
  );
});
