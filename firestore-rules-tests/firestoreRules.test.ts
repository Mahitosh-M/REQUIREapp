import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const projectId = 'requireapp-b74b3';
let environment: RulesTestEnvironment;

const user = (uid: string, role: 'admin' | 'staff', shopId: 'SHOP_A' | 'SHOP_B' | null) => ({
  uid,
  email: `${uid}@example.test`,
  name: uid,
  role,
  shopId,
  active: true,
  createdAt: Timestamp.fromMillis(1),
  updatedAt: Timestamp.fromMillis(1)
});

const company = (active = true) => ({
  name: 'Cipla', normalizedName: 'cipla', active, createdBy: 'admin',
  createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1)
});

const product = (overrides: Record<string, unknown> = {}) => ({
  companyId: 'company_cipla',
  name: 'Azee 500',
  normalizedName: 'azee 500',
  packaging: '5x3',
  normalizedPackaging: '5x3',
  catalogueKey: 'azee 500|5x3',
  reviewStatus: 'approved',
  createdBy: 'admin',
  createdByShopId: null,
  active: true,
  createdAt: Timestamp.fromMillis(1),
  updatedAt: Timestamp.fromMillis(1),
  ...overrides
});

const requirement = (shopId: 'SHOP_A' | 'SHOP_B', productId = 'product_azee') => ({
  productId,
  requestingShopId: shopId,
  quantityReference: '5',
  status: 'required',
  sourceShopId: null,
  destinationShopId: null,
  createdBy: shopId === 'SHOP_A' ? 'staff-a' : 'staff-b',
  createdAt: Timestamp.fromMillis(1),
  updatedAt: Timestamp.fromMillis(1)
});

const seed = async (includeRequirement = false) => environment.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await Promise.all([
    setDoc(doc(db, 'users/admin'), user('admin', 'admin', null)),
    setDoc(doc(db, 'users/staff-a'), user('staff-a', 'staff', 'SHOP_A')),
    setDoc(doc(db, 'users/staff-b'), user('staff-b', 'staff', 'SHOP_B')),
    setDoc(doc(db, 'companies/company_cipla'), company()),
    setDoc(doc(db, 'companies/company_inactive'), { ...company(false), name: 'Inactive', normalizedName: 'inactive' }),
    setDoc(doc(db, 'products/product_azee'), product())
  ]);
  if (includeRequirement) await setDoc(doc(db, 'requirements/SHOP_A_product_azee'), requirement('SHOP_A'));
});

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await seed();
});

afterAll(async () => environment.cleanup());

describe('identity and catalogue permissions', () => {
  it('blocks unauthenticated reads and inactive catalogue reads for staff', async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const staff = environment.authenticatedContext('staff-a').firestore();
    await assertFails(getDoc(doc(anonymous, 'companies/company_cipla')));
    await assertSucceeds(getDoc(doc(staff, 'companies/company_cipla')));
    await assertFails(getDoc(doc(staff, 'companies/company_inactive')));
  });

  it('allows staff to create a pending product but not an approved product or company', async () => {
    const staff = environment.authenticatedContext('staff-a').firestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'products/product_inactive'), product({ active: false }));
    });
    const pending = product({
      name: 'New Product', normalizedName: 'new product', packaging: '10x10',
      normalizedPackaging: '10x10', catalogueKey: 'new product|10x10',
      reviewStatus: 'pending', createdBy: 'staff-a', createdByShopId: 'SHOP_A',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await assertSucceeds(setDoc(doc(staff, 'products/product_new'), pending));
    await assertFails(setDoc(doc(staff, 'products/product_bad'), { ...pending, reviewStatus: 'approved' }));
    await assertFails(getDoc(doc(staff, 'products/product_inactive')));
    await assertFails(setDoc(doc(staff, 'companies/company_new'), { ...company(), createdBy: 'staff-a', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });

  it('keeps the signed-in admin active and in the admin role', async () => {
    const admin = environment.authenticatedContext('admin').firestore();
    await assertFails(updateDoc(doc(admin, 'users/admin'), { role: 'staff', shopId: 'SHOP_A', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(admin, 'users/admin'), { active: false, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(admin, 'users/admin'), { name: 'Admin User', updatedAt: serverTimestamp() }));
  });
});

describe('requirement workflow permissions', () => {
  it('allows staff to load required items with their active catalogue records', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'requirements/SHOP_B_product_azee'), requirement('SHOP_B'));
    });
    const staff = environment.authenticatedContext('staff-a').firestore();

    await assertSucceeds(getDocs(query(
      collection(staff, 'requirements'),
      where('status', '==', 'required'),
      orderBy('updatedAt', 'desc')
    )));
    await assertSucceeds(getDoc(doc(staff, 'products/product_azee')));
    await assertSucceeds(getDocs(query(
      collection(staff, 'products'),
      where('active', '==', true)
    )));
    await assertSucceeds(getDocs(query(
      collection(staff, 'companies'),
      where('active', '==', true),
      orderBy('normalizedName', 'asc')
    )));
  });

  it('allows own-shop creation and quantity editing while blocking shop spoofing', async () => {
    const staffA = environment.authenticatedContext('staff-a').firestore();
    const ownPayload = { ...requirement('SHOP_A'), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(staffA, 'requirements/SHOP_A_product_azee'), ownPayload));
    await assertSucceeds(updateDoc(doc(staffA, 'requirements/SHOP_A_product_azee'), { quantityReference: '8 boxes', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(staffA, 'requirements/SHOP_B_product_azee'), { ...requirement('SHOP_B'), createdBy: 'staff-a', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });

  it('supports pending product and requirement creation in the client transaction used by staff', async () => {
    const staffA = environment.authenticatedContext('staff-a').firestore();
    const productRef = doc(staffA, 'products/product_combo');
    const requirementRef = doc(staffA, 'requirements/SHOP_A_product_combo');
    await assertSucceeds(runTransaction(staffA, async (transaction) => {
      await transaction.get(productRef);
      await transaction.get(requirementRef);
      transaction.set(productRef, product({
        name: 'Combo', normalizedName: 'combo', packaging: '1x10', normalizedPackaging: '1x10',
        catalogueKey: 'combo|1x10', reviewStatus: 'pending', createdBy: 'staff-a', createdByShopId: 'SHOP_A',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }));
      transaction.set(requirementRef, {
        ...requirement('SHOP_A', 'product_combo'), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }));
  });

  it('enforces available, not-available, sent, return-to-sender, and received ownership', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'requirements/SHOP_A_product_azee'), requirement('SHOP_A'));
    });
    const staffA = environment.authenticatedContext('staff-a').firestore();
    const staffB = environment.authenticatedContext('staff-b').firestore();
    const referenceB = doc(staffB, 'requirements/SHOP_A_product_azee');
    const referenceA = doc(staffA, 'requirements/SHOP_A_product_azee');
    await assertSucceeds(updateDoc(referenceB, { status: 'to_send', sourceShopId: 'SHOP_B', destinationShopId: 'SHOP_A', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(referenceB, { status: 'required', sourceShopId: null, destinationShopId: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(referenceB, { status: 'to_send', sourceShopId: 'SHOP_B', destinationShopId: 'SHOP_A', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(referenceB, { status: 'incoming', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(referenceB, { status: 'to_send', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(referenceA, { status: 'to_send', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(referenceB, { status: 'incoming', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(staffB, 'requirements/SHOP_A_product_azee')));
    await assertSucceeds(deleteDoc(doc(staffA, 'requirements/SHOP_A_product_azee')));
  });

  it('blocks internal supply when both shops require the same product', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'requirements/SHOP_A_product_azee'), requirement('SHOP_A'));
      await setDoc(doc(db, 'requirements/SHOP_B_product_azee'), requirement('SHOP_B'));
    });
    const staffB = environment.authenticatedContext('staff-b').firestore();
    await assertFails(updateDoc(doc(staffB, 'requirements/SHOP_A_product_azee'), {
      status: 'to_send', sourceShopId: 'SHOP_B', destinationShopId: 'SHOP_A', updatedAt: serverTimestamp()
    }));
  });

  it('lets only an admin move a company order into the requesting shop incoming list', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'requirements/SHOP_A_product_azee'), requirement('SHOP_A'));
    });
    const admin = environment.authenticatedContext('admin').firestore();
    const staffA = environment.authenticatedContext('staff-a').firestore();
    const staffReference = doc(staffA, 'requirements/SHOP_A_product_azee');
    const adminReference = doc(admin, 'requirements/SHOP_A_product_azee');

    await assertFails(updateDoc(staffReference, {
      status: 'incoming',
      sourceShopId: null,
      destinationShopId: 'SHOP_A',
      companyOrderQuantityReference: '8 boxes',
      updatedAt: serverTimestamp()
    }));
    await assertSucceeds(updateDoc(adminReference, {
      status: 'incoming',
      sourceShopId: null,
      destinationShopId: 'SHOP_A',
      companyOrderQuantityReference: '8 boxes',
      updatedAt: serverTimestamp()
    }));
    await assertSucceeds(getDoc(staffReference));
    await assertSucceeds(deleteDoc(staffReference));
  });
});

describe('admin operations', () => {
  it('allows an admin to create catalogue data and user profiles', async () => {
    const admin = environment.authenticatedContext('admin').firestore();
    await assertSucceeds(setDoc(doc(admin, 'companies/company_alkem'), {
      name: 'Alkem', normalizedName: 'alkem', active: true, createdBy: 'admin',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(admin, 'users/new-staff'), {
      uid: 'new-staff', email: 'new@example.test', name: 'New Staff', role: 'staff', shopId: 'SHOP_B', active: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });

  it('allows an admin merge migration while preserving the original requester', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'products/product_duplicate'), product({
        name: 'AZEE-500', normalizedName: 'azee 500', createdBy: 'staff-a', createdByShopId: 'SHOP_A', reviewStatus: 'pending'
      }));
      await setDoc(doc(db, 'requirements/SHOP_A_product_duplicate'), requirement('SHOP_A', 'product_duplicate'));
    });
    const admin = environment.authenticatedContext('admin').firestore();
    const batch = writeBatch(admin);
    batch.set(doc(admin, 'requirements/SHOP_A_product_azee'), {
      ...requirement('SHOP_A'), updatedAt: serverTimestamp()
    });
    batch.delete(doc(admin, 'requirements/SHOP_A_product_duplicate'));
    batch.update(doc(admin, 'products/product_duplicate'), {
      active: false, mergedIntoProductId: 'product_azee', updatedAt: serverTimestamp()
    });
    await assertSucceeds(batch.commit());
  });
});
