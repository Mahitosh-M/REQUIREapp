import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type QueryConstraint,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AppUser,
  Company,
  Product,
  ProductInput,
  ProductReviewStatus,
  Requirement,
  ShopId,
  UserRole
} from '../types';
import {
  createCatalogueKey,
  createCompanyId,
  createProductId,
  createRequirementId,
  formatCatalogueText,
  normalizeCompanyName,
  normalizePackaging,
  normalizeProductName,
  rankProductSearch
} from '../utils/normalization';
import { normalizeQuantityReference, validateQuantityReference } from '../utils/workflow';

const USERS = 'users';
const COMPANIES = 'companies';
const PRODUCTS = 'products';
const REQUIREMENTS = 'requirements';
const productCache = new Map<string, Product>();
let activeProductSearchCache: Product[] | null = null;

const invalidateProductCaches = (...productIds: string[]) => {
  productIds.forEach((productId) => productCache.delete(productId));
  activeProductSearchCache = null;
};

const mapCompany = (snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): Company => {
  const data = snapshot.data()!;
  return {
    id: snapshot.id,
    name: formatCatalogueText(String(data.name || '')),
    normalizedName: String(data.normalizedName || ''),
    active: data.active === true,
    createdBy: String(data.createdBy || ''),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

const mapProduct = (snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): Product => {
  const data = snapshot.data()!;
  const product: Product = {
    id: snapshot.id,
    companyId: String(data.companyId || ''),
    name: formatCatalogueText(String(data.name || '')),
    normalizedName: String(data.normalizedName || ''),
    packaging: formatCatalogueText(String(data.packaging || '')),
    normalizedPackaging: String(data.normalizedPackaging || ''),
    catalogueKey: String(data.catalogueKey || ''),
    reviewStatus: data.reviewStatus === 'pending' ? 'pending' : 'approved',
    createdBy: String(data.createdBy || ''),
    createdByShopId: data.createdByShopId === 'SHOP_A' || data.createdByShopId === 'SHOP_B'
      ? data.createdByShopId
      : null,
    active: data.active === true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...(typeof data.mergedIntoProductId === 'string' ? { mergedIntoProductId: data.mergedIntoProductId } : {})
  };
  productCache.set(product.id, product);
  return product;
};

const mapRequirement = (
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): Requirement => {
  const data = snapshot.data()!;
  return {
    id: snapshot.id,
    productId: String(data.productId || ''),
    requestingShopId: data.requestingShopId,
    quantityReference: String(data.quantityReference || ''),
    status: data.status,
    sourceShopId: data.sourceShopId || null,
    destinationShopId: data.destinationShopId || null,
    createdBy: String(data.createdBy || ''),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...(typeof data.companyOrderQuantityReference === 'string'
      ? { companyOrderQuantityReference: data.companyOrderQuantityReference }
      : {})
  };
};

const mapUser = (snapshot: QueryDocumentSnapshot<DocumentData>): AppUser => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    uid: String(data.uid || snapshot.id),
    email: String(data.email || ''),
    name: String(data.name || ''),
    role: data.role === 'admin' ? 'admin' : 'staff',
    shopId: data.shopId === 'SHOP_A' || data.shopId === 'SHOP_B' ? data.shopId : null,
    active: data.active === true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

export class DuplicateRequirementError extends Error {
  existing: Requirement;

  constructor(existing: Requirement) {
    super('This product already has an active requirement for your shop.');
    this.name = 'DuplicateRequirementError';
    this.existing = existing;
  }
}

export const getFriendlyDataError = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code === 'permission-denied') return 'This action is not permitted for your account.';
  if (code === 'unavailable' || code === 'network-request-failed') return 'Check your internet connection and try again.';
  if (code === 'failed-precondition') return 'This item changed recently. Refresh and try again.';
  if (error instanceof Error && error.message) return error.message;
  return 'The action could not be completed. Please try again.';
};

export const getCompanies = async (includeInactive: boolean) => {
  const constraints: QueryConstraint[] = [];
  if (!includeInactive) constraints.push(where('active', '==', true));
  constraints.push(orderBy('normalizedName', 'asc'));
  const snapshot = await getDocs(query(collection(db, COMPANIES), ...constraints));
  return snapshot.docs.map(mapCompany);
};

export const createCompany = async (name: string, createdBy: string) => {
  const normalizedName = normalizeCompanyName(name);
  const companyRef = doc(db, COMPANIES, createCompanyId(normalizedName));
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(companyRef);
    if (existing.exists()) throw new Error('A company with this name already exists.');
    transaction.set(companyRef, {
      name: formatCatalogueText(name),
      normalizedName,
      active: true,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return companyRef.id;
  });
};

export const updateCompany = async (company: Company, changes: { name?: string; active?: boolean }) => {
  const nextName = formatCatalogueText(changes.name || company.name);
  const normalizedName = normalizeCompanyName(nextName);
  if (normalizedName !== company.normalizedName) {
    const duplicate = await getDocs(query(
      collection(db, COMPANIES),
      where('normalizedName', '==', normalizedName),
      limit(1)
    ));
    if (!duplicate.empty && duplicate.docs[0].id !== company.id) {
      throw new Error('A company with this name already exists.');
    }
  }
  await updateDoc(doc(db, COMPANIES, company.id), {
    name: nextName,
    normalizedName,
    active: changes.active ?? company.active,
    updatedAt: serverTimestamp()
  });
};

export const getProductsForCompany = async (companyId: string, includeInactive: boolean) => {
  const constraints: QueryConstraint[] = [where('companyId', '==', companyId)];
  if (!includeInactive) constraints.push(where('active', '==', true));
  constraints.push(orderBy('normalizedName', 'asc'));
  const snapshot = await getDocs(query(collection(db, PRODUCTS), ...constraints));
  return snapshot.docs.map(mapProduct);
};

export const getPendingProducts = async () => {
  const snapshot = await getDocs(query(
    collection(db, PRODUCTS),
    where('reviewStatus', '==', 'pending'),
    where('active', '==', true),
    orderBy('updatedAt', 'desc')
  ));
  return snapshot.docs.map(mapProduct);
};

export const getProductsByIds = async (productIds: string[]) => {
  const uniqueIds = Array.from(new Set(productIds));
  const products = new Map<string, Product>();
  const missing = uniqueIds.filter((id) => {
    const cached = productCache.get(id);
    if (cached) products.set(id, cached);
    return !cached;
  });

  for (let index = 0; index < missing.length; index += 30) {
    const ids = missing.slice(index, index + 30);
    const snapshots = await Promise.allSettled(ids.map((id) => getDoc(doc(db, PRODUCTS, id))));
    snapshots.forEach((result) => {
      if (result.status === 'rejected') {
        const code = typeof result.reason === 'object' && result.reason !== null && 'code' in result.reason
          ? String((result.reason as { code?: unknown }).code)
          : '';
        if (code === 'permission-denied') return;
        throw result.reason;
      }
      if (result.value.exists() && result.value.data().active === true) {
        const product = mapProduct(result.value);
        products.set(product.id, product);
      }
    });
  }
  return products;
};

export const searchActiveProducts = async (searchText: string) => {
  const term = normalizeProductName(searchText);
  if (term.length < 2) return [];
  if (!activeProductSearchCache) {
    const snapshot = await getDocs(query(collection(db, PRODUCTS), where('active', '==', true)));
    activeProductSearchCache = snapshot.docs.map(mapProduct);
  }
  return rankProductSearch(activeProductSearchCache, term).slice(0, 40);
};

const productPayload = (
  input: ProductInput,
  reviewStatus: ProductReviewStatus,
  createdBy: string,
  createdByShopId: ShopId | null
) => ({
  companyId: input.companyId,
  name: formatCatalogueText(input.name),
  normalizedName: normalizeProductName(input.name),
  packaging: formatCatalogueText(input.packaging),
  normalizedPackaging: normalizePackaging(input.packaging),
  catalogueKey: createCatalogueKey(input.name, input.packaging),
  reviewStatus,
  createdBy,
  createdByShopId,
  active: true,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

export const createProduct = async (
  input: ProductInput,
  reviewStatus: ProductReviewStatus,
  createdBy: string,
  createdByShopId: ShopId | null
) => {
  const id = createProductId(input.companyId, input.name, input.packaging);
  const productRef = doc(db, PRODUCTS, id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(productRef);
    if (existing.exists()) throw new Error('This product and packaging already exist for the selected company.');
    transaction.set(productRef, productPayload(input, reviewStatus, createdBy, createdByShopId));
  });
  invalidateProductCaches(id);
  return id;
};

export const saveProductChanges = async (
  product: Product,
  input: ProductInput,
  reviewStatus: ProductReviewStatus = product.reviewStatus
) => {
  const catalogueKey = createCatalogueKey(input.name, input.packaging);
  const duplicates = await getDocs(query(
    collection(db, PRODUCTS),
    where('companyId', '==', input.companyId),
    where('catalogueKey', '==', catalogueKey)
  ));
  if (duplicates.docs.some((row) => row.id !== product.id && row.data().active === true)) {
    throw new Error('An active product with this name and packaging already exists.');
  }
  await updateDoc(doc(db, PRODUCTS, product.id), {
    companyId: input.companyId,
    name: formatCatalogueText(input.name),
    normalizedName: normalizeProductName(input.name),
    packaging: formatCatalogueText(input.packaging),
    normalizedPackaging: normalizePackaging(input.packaging),
    catalogueKey,
    reviewStatus,
    updatedAt: serverTimestamp()
  });
  invalidateProductCaches(product.id);
};

export const setProductActive = async (product: Product, active: boolean) => {
  if (active && product.mergedIntoProductId) {
    throw new Error('A merged product cannot be reactivated. Use the retained catalogue product.');
  }
  if (!active) {
    const activeRequirement = await getDocs(query(
      collection(db, REQUIREMENTS),
      where('productId', '==', product.id),
      limit(1)
    ));
    if (!activeRequirement.empty) throw new Error('Complete or merge this product’s active requirements before deactivating it.');
  }
  await updateDoc(doc(db, PRODUCTS, product.id), {
    active,
    updatedAt: serverTimestamp()
  });
  invalidateProductCaches(product.id);
};

interface CreateRequirementInput {
  productId: string;
  shopId: ShopId;
  quantityReference: string;
  createdBy: string;
}

export const createRequirement = async (input: CreateRequirementInput) => {
  const requirementRef = doc(db, REQUIREMENTS, createRequirementId(input.shopId, input.productId));
  const productRef = doc(db, PRODUCTS, input.productId);
  await runTransaction(db, async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    const requirementSnapshot = await transaction.get(requirementRef);
    if (!productSnapshot.exists() || productSnapshot.data().active !== true) throw new Error('This product is no longer active.');
    if (requirementSnapshot.exists()) throw new DuplicateRequirementError(mapRequirement(requirementSnapshot));
    transaction.set(requirementRef, {
      productId: input.productId,
      requestingShopId: input.shopId,
      quantityReference: normalizeQuantityReference(input.quantityReference),
      status: 'required',
      sourceShopId: null,
      destinationShopId: null,
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
};

export const createProductAndRequirement = async (
  productInput: ProductInput,
  shopId: ShopId,
  quantityReference: string,
  createdBy: string
) => {
  const productId = createProductId(productInput.companyId, productInput.name, productInput.packaging);
  const productRef = doc(db, PRODUCTS, productId);
  const requirementRef = doc(db, REQUIREMENTS, createRequirementId(shopId, productId));
  await runTransaction(db, async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    const requirementSnapshot = await transaction.get(requirementRef);
    if (requirementSnapshot.exists()) throw new DuplicateRequirementError(mapRequirement(requirementSnapshot));
    if (productSnapshot.exists()) {
      if (productSnapshot.data().active !== true) throw new Error('This product exists but is inactive. Ask Admin to reactivate it.');
    } else {
      transaction.set(productRef, productPayload(productInput, 'pending', createdBy, shopId));
    }
    transaction.set(requirementRef, {
      productId,
      requestingShopId: shopId,
      quantityReference: normalizeQuantityReference(quantityReference),
      status: 'required',
      sourceShopId: null,
      destinationShopId: null,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
  invalidateProductCaches(productId);
  return productId;
};

export const updateRequirementQuantity = async (requirementId: string, quantityReference: string) => {
  await updateDoc(doc(db, REQUIREMENTS, requirementId), {
    quantityReference: normalizeQuantityReference(quantityReference),
    updatedAt: serverTimestamp()
  });
};

export const markRequirementAvailable = async (requirementId: string, actingShopId: ShopId) => {
  const requirementRef = doc(db, REQUIREMENTS, requirementId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requirementRef);
    if (!snapshot.exists()) throw new Error('This requirement no longer exists.');
    const requirement = mapRequirement(snapshot);
    if (requirement.status !== 'required') throw new Error('This requirement has already moved to another stage.');
    if (requirement.requestingShopId === actingShopId) throw new Error('A shop cannot supply its own requirement.');
    const ownRequirementRef = doc(db, REQUIREMENTS, createRequirementId(actingShopId, requirement.productId));
    const ownRequirement = await transaction.get(ownRequirementRef);
    if (ownRequirement.exists()) throw new Error('Both shops currently require this product. Leave it for company ordering.');
    transaction.update(requirementRef, {
      status: 'to_send',
      sourceShopId: actingShopId,
      destinationShopId: requirement.requestingShopId,
      updatedAt: serverTimestamp()
    });
  });
};

export const markRequirementNotAvailable = async (requirementId: string) => {
  const requirementRef = doc(db, REQUIREMENTS, requirementId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requirementRef);
    if (!snapshot.exists() || snapshot.data().status !== 'to_send') {
      throw new Error('This item is no longer in the To Send list.');
    }
    transaction.update(requirementRef, {
      status: 'required',
      sourceShopId: null,
      destinationShopId: null,
      updatedAt: serverTimestamp()
    });
  });
};

export const markRequirementSent = async (requirementId: string) => {
  const requirementRef = doc(db, REQUIREMENTS, requirementId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requirementRef);
    if (!snapshot.exists() || snapshot.data().status !== 'to_send') {
      throw new Error('This item is no longer in the To Send list.');
    }
    transaction.update(requirementRef, {
      status: 'incoming',
      updatedAt: serverTimestamp()
    });
  });
};

export const markRequirementCompanyOrdered = async (
  requirementId: string,
  companyOrderQuantityReference: string
) => {
  const normalizedQuantityReference = normalizeQuantityReference(companyOrderQuantityReference);
  const quantityError = validateQuantityReference(normalizedQuantityReference);
  if (quantityError) throw new Error(quantityError);

  const requirementRef = doc(db, REQUIREMENTS, requirementId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requirementRef);
    if (!snapshot.exists() || snapshot.data().status !== 'required') {
      throw new Error('This requirement is no longer waiting for company ordering.');
    }
    transaction.update(requirementRef, {
      status: 'incoming',
      sourceShopId: null,
      destinationShopId: snapshot.data().requestingShopId,
      companyOrderQuantityReference: normalizedQuantityReference,
      updatedAt: serverTimestamp()
    });
  });
};

export const markRequirementReceived = async (requirementId: string) => {
  const requirementRef = doc(db, REQUIREMENTS, requirementId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requirementRef);
    if (!snapshot.exists()) return;
    if (snapshot.data().status !== 'incoming') throw new Error('This item is not awaiting receipt.');
    transaction.delete(requirementRef);
  });
};

export const markRequirementNotReceived = async (requirementId: string) => {
  const requirementRef = doc(db, REQUIREMENTS, requirementId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requirementRef);
    if (!snapshot.exists() || snapshot.data().status !== 'incoming') {
      throw new Error('This item is no longer awaiting receipt.');
    }
    if (typeof snapshot.data().companyOrderQuantityReference === 'string') {
      throw new Error('Company orders cannot be returned to another shop.');
    }
    transaction.update(requirementRef, {
      status: 'to_send',
      updatedAt: serverTimestamp()
    });
  });
};

const listenRequirements = (
  constraints: QueryConstraint[],
  onData: (requirements: Requirement[]) => void,
  onError: (error: Error) => void
): Unsubscribe => onSnapshot(
  query(collection(db, REQUIREMENTS), ...constraints),
  (snapshot) => onData(snapshot.docs.map(mapRequirement)),
  onError
);

export const listenRequiredRequirements = (onData: (rows: Requirement[]) => void, onError: (error: Error) => void) => (
  listenRequirements([where('status', '==', 'required'), orderBy('updatedAt', 'desc')], onData, onError)
);

// Used by staff alerts. It deliberately omits ordering so the subscription stays narrow.
export const listenRequiredRequirementsForShop = (
  shopId: ShopId,
  onData: (rows: Requirement[]) => void,
  onError: (error: Error) => void
) => listenRequirements([
  where('status', '==', 'required'),
  where('requestingShopId', '==', shopId)
], onData, onError);

export const listenToSendRequirements = (
  shopId: ShopId,
  onData: (rows: Requirement[]) => void,
  onError: (error: Error) => void
) => listenRequirements([
  where('status', '==', 'to_send'),
  where('sourceShopId', '==', shopId),
  orderBy('updatedAt', 'desc')
], onData, onError);

export const listenIncomingRequirements = (
  shopId: ShopId,
  onData: (rows: Requirement[]) => void,
  onError: (error: Error) => void
) => listenRequirements([
  where('status', '==', 'incoming'),
  where('destinationShopId', '==', shopId),
  orderBy('updatedAt', 'desc')
], onData, onError);

export const listenAllRequirements = (onData: (rows: Requirement[]) => void, onError: (error: Error) => void) => (
  listenRequirements([orderBy('updatedAt', 'desc')], onData, onError)
);

export const mergeProduct = async (duplicate: Product, retained: Product) => {
  if (duplicate.id === retained.id) throw new Error('Choose a different product to retain.');
  if (duplicate.companyId !== retained.companyId) throw new Error('Products can only be merged within the same company.');

  await runTransaction(db, async (transaction) => {
    const duplicateRef = doc(db, PRODUCTS, duplicate.id);
    const retainedRef = doc(db, PRODUCTS, retained.id);
    const shops: ShopId[] = ['SHOP_A', 'SHOP_B'];
    const sourceRefs = shops.map((shopId) => doc(db, REQUIREMENTS, createRequirementId(shopId, duplicate.id)));
    const targetRefs = shops.map((shopId) => doc(db, REQUIREMENTS, createRequirementId(shopId, retained.id)));
    const [duplicateProduct, retainedProduct, ...requirementSnapshots] = await Promise.all([
      transaction.get(duplicateRef),
      transaction.get(retainedRef),
      ...sourceRefs.map((sourceRef) => transaction.get(sourceRef)),
      ...targetRefs.map((targetRef) => transaction.get(targetRef))
    ]);
    if (!duplicateProduct.exists() || duplicateProduct.data().active !== true) throw new Error('The duplicate product is no longer active.');
    if (!retainedProduct.exists() || retainedProduct.data().active !== true) throw new Error('The retained product is no longer active.');

    const sourceSnapshots = requirementSnapshots.slice(0, shops.length);
    const targetSnapshots = requirementSnapshots.slice(shops.length);
    if (shops.some((_, index) => sourceSnapshots[index].exists() && targetSnapshots[index].exists())) {
      throw new Error('Both products have an active requirement for the same shop. Resolve one requirement before merging.');
    }

    sourceSnapshots.forEach((source, index) => {
      if (!source.exists()) return;
      transaction.set(targetRefs[index], {
        ...source.data(),
        productId: retained.id,
        updatedAt: serverTimestamp()
      });
      transaction.delete(source.ref);
    });
    transaction.update(duplicateRef, {
      active: false,
      mergedIntoProductId: retained.id,
      updatedAt: serverTimestamp()
    });
  });
  invalidateProductCaches(duplicate.id, retained.id);
};

export const getUsers = async () => {
  const snapshot = await getDocs(query(collection(db, USERS), orderBy('name', 'asc')));
  return snapshot.docs.map(mapUser);
};

export const createUserProfile = async (input: {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  shopId: ShopId | null;
}) => {
  const userRef = doc(db, USERS, input.uid.trim());
  const batch = writeBatch(db);
  batch.set(userRef, {
    uid: input.uid.trim(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    shopId: input.role === 'staff' ? input.shopId : input.shopId,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
};

export const updateUserProfile = async (
  user: AppUser,
  changes: { name?: string; role?: UserRole; shopId?: ShopId | null; active?: boolean }
) => {
  const role = changes.role ?? user.role;
  const shopId = changes.shopId === undefined ? user.shopId : changes.shopId;
  if (role === 'staff' && !shopId) throw new Error('Staff must be assigned to a shop.');
  await updateDoc(doc(db, USERS, user.id), {
    name: changes.name?.trim() || user.name,
    role,
    shopId,
    active: changes.active ?? user.active,
    updatedAt: serverTimestamp()
  });
};
