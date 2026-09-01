import type { Timestamp } from 'firebase/firestore';

export type ShopId = 'SHOP_A' | 'SHOP_B';
export type UserRole = 'admin' | 'staff';
export type RequirementStatus = 'required' | 'to_send' | 'incoming';
export type ProductReviewStatus = 'approved' | 'pending';

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  shopId: ShopId | null;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Company {
  id: string;
  name: string;
  normalizedName: string;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  normalizedName: string;
  packaging: string;
  normalizedPackaging: string;
  catalogueKey: string;
  reviewStatus: ProductReviewStatus;
  createdBy: string;
  createdByShopId: ShopId | null;
  active: boolean;
  mergedIntoProductId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Requirement {
  id: string;
  productId: string;
  requestingShopId: ShopId;
  quantityReference: string;
  companyOrderQuantityReference?: string;
  status: RequirementStatus;
  sourceShopId: ShopId | null;
  destinationShopId: ShopId | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductInput {
  companyId: string;
  name: string;
  packaging: string;
}

export interface RequirementProductGroup {
  productId: string;
  requirements: Requirement[];
}

export interface DuplicateRequirementResult {
  requirement: Requirement;
  requestedQuantityReference: string;
}
