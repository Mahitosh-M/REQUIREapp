import { describe, expect, it } from 'vitest';
import type { Requirement } from '../types';
import {
  applyAvailableTransition,
  applyNotAvailableTransition,
  applyNotReceivedTransition,
  applySentTransition,
  canShopSupplyRequirement,
  groupRequirementsByProduct,
  planRequirementMigration,
  validateQuantityReference
} from './workflow';

const requirement = (id: string, shop: 'SHOP_A' | 'SHOP_B', productId = 'product_azee'): Requirement => ({
  id,
  productId,
  requestingShopId: shop,
  quantityReference: '5',
  status: 'required',
  sourceShopId: null,
  destinationShopId: null,
  createdBy: `staff-${shop}`,
  createdAt: null!,
  updatedAt: null!
});

describe('requirement workflow', () => {
  it('moves requirements between required, to-send, incoming, and back to sender', () => {
    const required = requirement('SHOP_A_product_azee', 'SHOP_A');
    const toSend = applyAvailableTransition(required, 'SHOP_B');
    expect(toSend).toMatchObject({ status: 'to_send', sourceShopId: 'SHOP_B', destinationShopId: 'SHOP_A' });
    expect(applyNotAvailableTransition(toSend)).toMatchObject({ status: 'required', sourceShopId: null, destinationShopId: null });
    const incoming = applySentTransition(toSend);
    expect(incoming).toMatchObject({ status: 'incoming', sourceShopId: 'SHOP_B', destinationShopId: 'SHOP_A' });
    expect(applyNotReceivedTransition(incoming)).toMatchObject({ status: 'to_send', sourceShopId: 'SHOP_B', destinationShopId: 'SHOP_A' });
  });

  it('prevents supply when the acting shop also requires the same product', () => {
    const shopA = requirement('SHOP_A_product_azee', 'SHOP_A');
    const shopB = requirement('SHOP_B_product_azee', 'SHOP_B');
    expect(canShopSupplyRequirement(shopA, 'SHOP_B', [shopA])).toBe(true);
    expect(canShopSupplyRequirement(shopA, 'SHOP_B', [shopA, shopB])).toBe(false);
    expect(canShopSupplyRequirement(shopA, 'SHOP_A', [shopA])).toBe(false);
  });

  it('consolidates both shops into one product group without adding quantities', () => {
    const rows = [requirement('a', 'SHOP_A'), requirement('b', 'SHOP_B'), requirement('c', 'SHOP_A', 'product_other')];
    const groups = groupRequirementsByProduct(rows);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.productId === 'product_azee')?.requirements.map((row) => row.quantityReference)).toEqual(['5', '5']);
  });

  it('plans safe product migrations and exposes same-shop conflicts', () => {
    const duplicateRows = [requirement('a', 'SHOP_A'), requirement('b', 'SHOP_B')];
    const retainedRows = [requirement('retained-a', 'SHOP_A', 'retained')];
    const plan = planRequirementMigration(duplicateRows, 'retained', retainedRows);
    expect(plan.conflicts.map((row) => row.requestingShopId)).toEqual(['SHOP_A']);
    expect(plan.migrations).toHaveLength(1);
    expect(plan.migrations[0]).toMatchObject({ productId: 'retained', requestingShopId: 'SHOP_B' });
  });

  it('keeps quantity as a short human reference', () => {
    expect(validateQuantityReference('')).toBeTruthy();
    expect(validateQuantityReference('5 boxes')).toBe('');
    expect(validateQuantityReference('x'.repeat(41))).toBeTruthy();
  });
});
