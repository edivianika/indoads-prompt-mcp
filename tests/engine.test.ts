import assert from 'node:assert/strict';
import test from 'node:test';
import { composePrompt, getPrompt, listTaxonomy, searchPrompts } from '../src/lib/engine.js';

test('corpus is loaded', () => {
  assert.ok(listTaxonomy().promptCount >= 40);
});

test('F&B search prioritizes F&B concepts', () => {
  const result = searchPrompts({ category: 'fnb', productType: 'sambal', query: 'spicy appetite', count: 5 });
  assert.equal(result.length, 5);
  assert.ok(result.some((x) => x.categories.includes('fnb')));
});

test('prompt can be composed with reference fidelity', () => {
  const first = searchPrompts({ category: 'beauty', count: 1 })[0];
  assert.ok(first);
  const composed = composePrompt({
    promptId: first.id,
    productName: 'Serum A',
    productDescription: 'clear 30ml glass dropper bottle',
    hasReferenceImage: true,
    aspectRatio: '4:5',
  });
  assert.match(composed.prompt, /REFERENCE PRODUCT FIDELITY/);
  assert.match(composed.prompt, /4:5/);
});

test('known IDs resolve', () => {
  assert.ok(getPrompt('FNB-001'));
});
