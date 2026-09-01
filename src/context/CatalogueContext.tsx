import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { getCompanies, getFriendlyDataError, getProductsForCompany } from '../services/dataService';
import type { Company, Product } from '../types';
import { useAuth } from './AuthContext';

interface ProductCacheEntry {
  includesInactive: boolean;
  products: Product[];
}

interface CatalogueContextValue {
  companies: Company[];
  companyMap: Map<string, Company>;
  loading: boolean;
  error: string;
  refreshCompanies: () => Promise<void>;
  loadProducts: (companyId: string, force?: boolean) => Promise<Product[]>;
  invalidateProducts: (companyId?: string) => void;
}

const CatalogueContext = createContext<CatalogueContextValue | undefined>(undefined);

export const CatalogueProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const productCache = useRef(new Map<string, ProductCacheEntry>());

  const refreshCompanies = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      setCompanies(await getCompanies(profile.role === 'admin'));
      setError('');
    } catch (loadError) {
      setError(getFriendlyDataError(loadError));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    productCache.current.clear();
    if (!profile) {
      setCompanies([]);
      return;
    }
    void refreshCompanies();
  }, [profile, refreshCompanies]);

  const loadProducts = useCallback(async (companyId: string, force = false) => {
    if (!profile) return [];
    const includeInactive = profile.role === 'admin';
    const cached = productCache.current.get(companyId);
    if (!force && cached && (cached.includesInactive || !includeInactive)) return cached.products;
    const products = await getProductsForCompany(companyId, includeInactive);
    productCache.current.set(companyId, { includesInactive: includeInactive, products });
    return products;
  }, [profile]);

  const value = useMemo<CatalogueContextValue>(() => ({
    companies,
    companyMap: new Map(companies.map((company) => [company.id, company])),
    loading,
    error,
    refreshCompanies,
    loadProducts,
    invalidateProducts: (companyId) => {
      if (companyId) productCache.current.delete(companyId);
      else productCache.current.clear();
    }
  }), [companies, error, loadProducts, loading, refreshCompanies]);

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
};

export const useCatalogue = () => {
  const value = useContext(CatalogueContext);
  if (!value) throw new Error('useCatalogue must be used inside CatalogueProvider.');
  return value;
};
