import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth';
import { deleteApp, initializeApp } from 'firebase/app';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';
import type { AppUser, ShopId, UserRole } from '../types';
import { isShopId } from '../utils/shops';

const isRole = (value: unknown): value is UserRole => value === 'admin' || value === 'staff';

export const loadUserProfile = async (user: User): Promise<AppUser> => {
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  if (!snapshot.exists()) throw new Error('Your REQUIREapp access profile has not been created.');
  const data = snapshot.data();
  if (!isRole(data.role) || data.active !== true) throw new Error('Your REQUIREapp access is inactive.');
  const shopId: ShopId | null = isShopId(data.shopId) ? data.shopId : null;
  if (data.role === 'staff' && !shopId) throw new Error('Your staff account is not assigned to a shop.');

  return {
    id: snapshot.id,
    // Firestore profile fields can be corrected by an admin. Writes must always
    // use the authenticated Firebase UID required by the security rules.
    uid: user.uid,
    email: String(data.email || user.email || ''),
    name: String(data.name || user.email || 'User'),
    role: data.role,
    shopId,
    active: true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

// Keep staff and admin sessions on this device until they explicitly use Log out.
// Firebase refreshes the ID token in the background without changing this setting.
export const enablePersistentAuthSession = () => setPersistence(auth, browserLocalPersistence);

export const loginWithEmail = async (email: string, password: string) => {
  await enablePersistentAuthSession();
  return signInWithEmailAndPassword(auth, email.trim(), password);
};

export const logout = () => signOut(auth);

export const listenToAuth = (callback: (user: User | null) => void) => onAuthStateChanged(auth, callback);

export const createManagedUser = async (input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  shopId: ShopId | null;
}) => {
  const secondaryApp = initializeApp(firebaseConfig, `requireapp-user-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: User | null = null;
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email.trim(), input.password);
    createdUser = credential.user;
    await setDoc(doc(db, 'users', createdUser.uid), {
      uid: createdUser.uid,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role,
      shopId: input.shopId,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return createdUser.uid;
  } catch (error) {
    if (createdUser) {
      try { await deleteUser(createdUser); } catch { /* Firestore remains authoritative for app access. */ }
    }
    throw error;
  } finally {
    await deleteApp(secondaryApp);
  }
};

export const getFriendlyAuthError = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email or password is incorrect.';
  }
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
  if (code === 'auth/network-request-failed') return 'Check your internet connection and try again.';
  if (code === 'auth/email-already-in-use') return 'An Authentication account already uses this email.';
  if (code === 'auth/weak-password') return 'Use a password with at least 6 characters.';
  if (code === 'permission-denied') return 'Your account does not have permission to use REQUIREapp.';
  if (error instanceof Error && error.message) return error.message;
  return 'Sign in failed. Please try again.';
};
