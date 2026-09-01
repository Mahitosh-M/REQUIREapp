import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import {
  createCatalogueKey,
  createProductId,
  getDuplicateCandidates,
  normalizePackaging,
  normalizeProductName,
  rankProductSearch
} from './normalization';

const product = (id: string, name: string, packaging: string): Product => ({
  id,
  companyId: 'company_cipla',
  name,
  normalizedName: normalizeProductName(name),
  packaging,
  normalizedPackaging: normalizePackaging(packaging),
  catalogueKey: createCatalogueKey(name, packaging),
  reviewStatus: 'approved',
  createdBy: 'admin',
  createdByShopId: null,
  active: true,
  createdAt: null!,
  updatedAt: null!
});

describe('catalogue normalization', () => {
  it('normalizes case, whitespace, and common product separators', () => {
    expect(normalizeProductName('  AZEE-500  ')).toBe('azee 500');
    expect(normalizeProductName('Azee   500')).toBe('azee 500');
  });

  it('normalizes equivalent packaging without discarding quantities', () => {
    const equivalent = ['10 X 10', '10x10', '10 \u00d7 10', '10*10'].map(normalizePackaging);
    expect(new Set(equivalent)).toEqual(new Set(['10x10']));
    expect(normalizePackaging('100 ML')).toBe('100ml');
    expect(normalizePackaging('100 ml')).not.toBe(normalizePackaging('120 ml'));
  });

  it('creates one stable identity for equivalent entries and separate identities for pack sizes', () => {
    expect(createProductId('cipla', 'AZEE-500', '5 X 3')).toBe(createProductId('cipla', 'azee 500', '5x3'));
    expect(createProductId('cipla', 'Azee 500', '5x3')).not.toBe(createProductId('cipla', 'Azee 500', '10x3'));
  });

  it('ranks exact and starts-with matches before contains matches', () => {
    const rows = [product('contains', 'Super Azee', '1x1'), product('starts', 'Azee 250', '1x1'), product('exact', 'Azee', '1x1')];
    expect(rankProductSearch(rows, 'azee').map((row) => row.id)).toEqual(['exact', 'starts', 'contains']);
  });

  it('does not label the same name with different packaging as a strong duplicate', () => {
    const target = product('pending', 'AZEE-500', '5 X 3');
    const exact = product('exact', 'Azee 500', '5x3');
    const otherPack = product('other-pack', 'Azee 500', '10x3');
    const candidates = getDuplicateCandidates(target, [exact, otherPack]);
    expect(candidates.find((row) => row.product.id === 'exact')?.strength).toBe('strong');
    expect(candidates.find((row) => row.product.id === 'other-pack')?.strength).toBe('possible');
  });
});
