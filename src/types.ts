export type PromptCategory =
  | 'general'
  | 'fnb'
  | 'beauty'
  | 'fashion'
  | 'tech'
  | 'home'
  | 'property'
  | 'automotive';

export interface PromptTemplate {
  id: string;
  title: string;
  categories: PromptCategory[];
  productTypes: string[];
  objectives: string[];
  visualConcept: string;
  styleTags: string[];
  platforms: string[];
  aspectRatios: string[];
  modelHints: string[];
  qualityScore: number;
  sceneDirection: string;
  composition: string;
  lighting: string;
  camera: string;
  background: string;
  effects: string;
  copyZone: string;
  avoid: string[];
}

export interface SearchInput {
  query?: string;
  category?: string;
  productType?: string;
  objective?: string;
  style?: string;
  platform?: string;
  aspectRatio?: string;
  model?: string;
  count?: number;
  diversify?: boolean;
}

export interface SearchResult {
  id: string;
  title: string;
  visualConcept: string;
  score: number;
  matchReasons: string[];
  categories: string[];
  styleTags: string[];
  productTypes: string[];
  aspectRatios: string[];
  qualityScore: number;
}

export interface ComposeInput {
  promptId: string;
  productName: string;
  brandName?: string;
  productDescription?: string;
  keyBenefit?: string;
  targetAudience?: string;
  copyText?: string;
  aspectRatio?: string;
  hasReferenceImage?: boolean;
  extraInstructions?: string;
}
