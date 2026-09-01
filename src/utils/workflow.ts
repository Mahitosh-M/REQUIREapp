import type { Requirement, RequirementProductGroup, ShopId } from '../types';

export const groupRequirementsByProduct = (requirements: Requirement[]): RequirementProductGroup[] => {
  const groups = new Map<string, Requirement[]>();
  requirements.forEach((requirement) => {
    const group = groups.get(requirement.productId) || [];
    group.push(requirement);
    groups.set(requirement.productId, group);
  });
  return Array.from(groups, ([productId, rows]) => ({ productId, requirements: rows }));
};

export const canShopSupplyRequirement = (
  requirement: Requirement,
  actingShopId: ShopId,
  activeRequirements: Requirement[]
) => requirement.status === 'required'
  && requirement.requestingShopId !== actingShopId
  && !activeRequirements.some((row) => row.productId === requirement.productId
    && row.requestingShopId === actingShopId);

export const applyAvailableTransition = (requirement: Requirement, sourceShopId: ShopId): Requirement => ({
  ...requirement,
  status: 'to_send',
  sourceShopId,
  destinationShopId: requirement.requestingShopId
});

export const applyNotAvailableTransition = (requirement: Requirement): Requirement => ({
  ...requirement,
  status: 'required',
  sourceShopId: null,
  destinationShopId: null
});

export const applySentTransition = (requirement: Requirement): Requirement => ({
  ...requirement,
  status: 'incoming'
});

export const applyNotReceivedTransition = (requirement: Requirement): Requirement => ({
  ...requirement,
  status: 'to_send'
});

export interface RequirementMigrationPlan {
  migrations: Requirement[];
  conflicts: Requirement[];
}

export const planRequirementMigration = (
  duplicateRequirements: Requirement[],
  retainedProductId: string,
  retainedRequirements: Requirement[]
): RequirementMigrationPlan => {
  const retainedShops = new Set(retainedRequirements.map((requirement) => requirement.requestingShopId));
  return duplicateRequirements.reduce<RequirementMigrationPlan>((plan, requirement) => {
    if (retainedShops.has(requirement.requestingShopId)) {
      plan.conflicts.push(requirement);
      return plan;
    }
    plan.migrations.push({ ...requirement, productId: retainedProductId });
    return plan;
  }, { migrations: [], conflicts: [] });
};

export const normalizeQuantityReference = (value: string) => value.trim().replace(/\s+/g, ' ');

export const validateQuantityReference = (value: string) => {
  const normalized = normalizeQuantityReference(value);
  if (!normalized) return 'Enter a quantity reference.';
  if (normalized.length > 40) return 'Keep the quantity reference within 40 characters.';
  return '';
};
