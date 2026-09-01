import type { Requirement } from '../types';

const STORAGE_PREFIX = 'requireapp:staff-other-shop-dismissals';

const createdAtVersion = (requirement: Requirement) => requirement.createdAt?.toMillis?.() ?? 'unversioned';

export const getRequirementDismissalKey = (requirement: Requirement) => `${requirement.id}:${createdAtVersion(requirement)}`;

const storageKeyFor = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

export const readDismissedOtherShopRequirements = (userId: string) => {
  try {
    const stored = window.localStorage.getItem(storageKeyFor(userId));
    if (!stored) return new Set<string>();
    const parsed: unknown = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set<string>();
  }
};

export const dismissOtherShopRequirement = (userId: string, requirement: Requirement) => {
  const dismissed = readDismissedOtherShopRequirements(userId);
  dismissed.add(getRequirementDismissalKey(requirement));
  try {
    window.localStorage.setItem(storageKeyFor(userId), JSON.stringify([...dismissed]));
  } catch {
    // The current view still updates when browser storage is unavailable.
  }
  return dismissed;
};
