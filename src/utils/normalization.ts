import type { Product } from '../types';

const normalizeBase = (value: string) => value
  .normalize('NFKC')
  .trim()
  .toLowerCase();

export const normalizeCompanyName = (value: string) => normalizeBase(value)
  .replace(/[._-]+/g, ' ')
  .replace(/\s+/g, ' ');

export const normalizeProductName = (value: string) => normalizeBase(value)
  .replace(/[._-]+/g, ' ')
  .replace(/\s+/g, ' ');

export const normalizePackaging = (value: string) => normalizeBase(value)
  .replace(/[\u00d7\u2715\u2716*]/g, 'x')
  .replace(/\s*x\s*/g, 'x')
  .replace(/(\d)\s+(ml|mg|gm|g|kg|l)\b/g, '$1$2')
  .replace(/\s+/g, ' ');

export const createCatalogueKey = (name: string, packaging: string) => (
  `${normalizeProductName(name)}|${normalizePackaging(packaging)}`
);

const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

export const createCompanyId = (name: string) => `company_${fnv1a(normalizeCompanyName(name))}`;

export const createProductId = (companyId: string, name: string, packaging: string) => (
  `product_${fnv1a(`${companyId}|${createCatalogueKey(name, packaging)}`)}`
);

export const createRequirementId = (shopId: string, productId: string) => `${shopId}_${productId}`;

export const rankProductSearch = (products: Product[], searchText: string) => {
  const term = normalizeProductName(searchText);
  if (!term) return [...products].sort((left, right) => left.normalizedName.localeCompare(right.normalizedName));

  return products
    .map((product) => {
      const name = product.normalizedName;
      const rank = name === term ? 0 : name.startsWith(term) ? 1 : name.includes(term) ? 2 : 3;
      return { product, rank };
    })
    .filter(({ rank }) => rank < 3)
    .sort((left, right) => left.rank - right.rank
      || left.product.normalizedName.localeCompare(right.product.normalizedName)
      || left.product.normalizedPackaging.localeCompare(right.product.normalizedPackaging))
    .map(({ product }) => product);
};

const levenshteinDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
};

export const textSimilarity = (left: string, right: string) => {
  const normalizedLeft = normalizeProductName(left);
  const normalizedRight = normalizeProductName(right);
  const maximumLength = Math.max(normalizedLeft.length, normalizedRight.length);
  if (maximumLength === 0) return 1;
  return 1 - (levenshteinDistance(normalizedLeft, normalizedRight) / maximumLength);
};

export interface DuplicateCandidate {
  product: Product;
  strength: 'strong' | 'possible';
  score: number;
}

export const getDuplicateCandidates = (target: Product, companyProducts: Product[]): DuplicateCandidate[] => (
  companyProducts
    .filter((candidate) => candidate.id !== target.id && candidate.active)
    .map((candidate) => {
      const nameScore = textSimilarity(target.name, candidate.name);
      const samePackaging = target.normalizedPackaging === candidate.normalizedPackaging;
      return {
        product: candidate,
        strength: samePackaging && nameScore >= 0.88 ? 'strong' as const : 'possible' as const,
        score: nameScore + (samePackaging ? 0.35 : 0)
      };
    })
    .filter(({ score, product }) => score >= 0.72
      || product.normalizedName.includes(target.normalizedName)
      || target.normalizedName.includes(product.normalizedName))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
);
