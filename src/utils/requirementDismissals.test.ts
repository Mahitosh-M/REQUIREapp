import { describe, expect, it } from 'vitest';
import type { Requirement } from '../types';
import { getRequirementDismissalKey } from './requirementDismissals';

const requirement = (createdAt: number): Requirement => ({
  id: 'SHOP_A_product_ashoka',
  productId: 'product_ashoka',
  requestingShopId: 'SHOP_A',
  quantityReference: '3 boxes',
  status: 'required',
  sourceShopId: null,
  destinationShopId: null,
  createdBy: 'staff-a',
  createdAt: { toMillis: () => createdAt } as Requirement['createdAt'],
  updatedAt: null!
});

describe('other-shop requirement dismissals', () => {
  it('keeps a replacement requirement visible when its creation time changes', () => {
    expect(getRequirementDismissalKey(requirement(100))).not.toBe(getRequirementDismissalKey(requirement(200)));
  });
});
