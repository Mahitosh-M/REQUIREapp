import type { ShopId } from '../types';

export const SHOP_OPTIONS: Array<{ id: ShopId; name: string; shortName: string }> = [
  { id: 'SHOP_A', name: 'ASHOKA', shortName: 'ASHOKA' },
  { id: 'SHOP_B', name: 'SMPA', shortName: 'SMPA' }
];

export const isShopId = (value: unknown): value is ShopId => value === 'SHOP_A' || value === 'SHOP_B';

export const getShopName = (shopId: ShopId | null | undefined) => (
  SHOP_OPTIONS.find((shop) => shop.id === shopId)?.name || 'Unassigned shop'
);

export const getOtherShopId = (shopId: ShopId): ShopId => shopId === 'SHOP_A' ? 'SHOP_B' : 'SHOP_A';
