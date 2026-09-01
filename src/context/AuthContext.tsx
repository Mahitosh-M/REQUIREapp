import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  enablePersistentAuthSession,
  getFriendlyAuthError,
  listenToAuth,
  loadUserProfile,
  loginWithEmail,
  logout
} from '../services/authService';
import type { AppUser, ShopId } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  actingShopId: ShopId | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActingShopId: (shopId: ShopId) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const ADMIN_SHOP_KEY = 'requireapp:admin-shop';

const readAdminShop = (): ShopId => window.localStorage.getItem(ADMIN_SHOP_KEY) === 'SHOP_B' ? 'SHOP_B' : 'SHOP_A';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [adminShopId, setAdminShopId] = useState<ShopId>(readAdminShop);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const applyProfile = async (user: User) => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    try {
      const nextProfile = await loadUserProfile(user);
      if (activeRequest !== requestId.current) return;
      setProfile(nextProfile);
      if (nextProfile.role === 'admin' && nextProfile.shopId) setAdminShopId(nextProfile.shopId);
      setError('');
    } catch (profileError) {
      if (activeRequest !== requestId.current) return;
      setProfile(null);
      setError(getFriendlyAuthError(profileError));
    } finally {
      if (activeRequest === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = listenToAuth((user) => {
      setFirebaseUser(user);
      if (!user) {
        ++requestId.current;
        setProfile(null);
        setError('');
        setLoading(false);
        return;
      }
      void applyProfile(user);
    });

    // Migrate any restored Firebase session to durable local browser storage.
    // This does not sign the user out when profile data is temporarily unavailable.
    void enablePersistentAuthSession().catch((persistenceError) => {
      setError(getFriendlyAuthError(persistenceError));
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setError('');
    try {
      await loginWithEmail(email, password);
    } catch (loginError) {
      const message = getFriendlyAuthError(loginError);
      setError(message);
      throw loginError;
    }
  };

  const logoutUser = async () => {
    ++requestId.current;
    setFirebaseUser(null);
    setProfile(null);
    setError('');
    await logout();
  };

  const actingShopId = profile?.role === 'staff' ? profile.shopId : profile?.role === 'admin' ? adminShopId : null;
  const value = useMemo<AuthContextValue>(() => ({
    firebaseUser,
    profile,
    actingShopId,
    loading,
    error,
    login,
    logout: logoutUser,
    setActingShopId: (shopId) => {
      if (profile?.role !== 'admin') return;
      setAdminShopId(shopId);
      window.localStorage.setItem(ADMIN_SHOP_KEY, shopId);
    },
    refreshProfile: async () => {
      if (firebaseUser) await applyProfile(firebaseUser);
    }
  }), [actingShopId, error, firebaseUser, loading, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
};
