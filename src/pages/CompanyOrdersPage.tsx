import { Building2, CheckCircle2, ChevronDown, Package } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState, PageHeader, SearchField, useToast } from '../components/ui';
import { useCatalogue } from '../context/CatalogueContext';
import { useRequirements } from '../hooks/useRequirements';
import { getFriendlyDataError, markRequirementCompanyOrdered } from '../services/dataService';
import type { Company, Product, Requirement } from '../types';
import { normalizeProductName } from '../utils/normalization';
import { getShopName } from '../utils/shops';
import { groupRequirementsByProduct, validateQuantityReference } from '../utils/workflow';

interface CompanyRequirementGroup {
  company: Company | undefined;
  products: Array<{ product: Product; requirements: Requirement[] }>;
}

export const CompanyOrdersPage = () => {
  const { companyMap } = useCatalogue();
  const { requirements, products, loading, error } = useRequirements('required');
  const [search, setSearch] = useState('');
  const [companyQuantities, setCompanyQuantities] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const toast = useToast();

  const groups = useMemo(() => {
    const term = normalizeProductName(search);
    const companyGroups = new Map<string, CompanyRequirementGroup>();
    groupRequirementsByProduct(requirements).forEach((productGroup) => {
      const product = products.get(productGroup.productId);
      if (!product) return;
      const company = companyMap.get(product.companyId);
      if (term && !product.normalizedName.includes(term) && !company?.normalizedName.includes(term)) return;
      const group = companyGroups.get(product.companyId) || { company, products: [] };
      group.products.push({ product, requirements: productGroup.requirements });
      companyGroups.set(product.companyId, group);
    });
    return Array.from(companyGroups.values())
      .map((group) => ({ ...group, products: group.products.sort((left, right) => left.product.normalizedName.localeCompare(right.product.normalizedName)) }))
      .sort((left, right) => (left.company?.normalizedName || '').localeCompare(right.company?.normalizedName || ''));
  }, [companyMap, products, requirements, search]);

  const markAsOrdered = async (requirement: Requirement) => {
    const companyQuantity = companyQuantities[requirement.id] ?? requirement.quantityReference;
    const quantityError = validateQuantityReference(companyQuantity);
    if (quantityError) {
      toast(quantityError, 'error');
      return;
    }
    setBusyId(requirement.id);
    try {
      await markRequirementCompanyOrdered(requirement.id, companyQuantity);
      setCompanyQuantities((current) => {
        const next = { ...current };
        delete next[requirement.id];
        return next;
      });
    } catch (actionError) {
      toast(getFriendlyDataError(actionError), 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Purchase planning" title="Company Requirements" />
      <div className="toolbar"><SearchField value={search} onChange={setSearch} placeholder="Search company or product" /></div>
      {loading ? <LoadingState label="Grouping required items" /> : error ? <ErrorState message={error} /> : !groups.length ? (
        <EmptyState icon={<Building2 size={30} />} title="No company requirements" detail="All active requirements are being fulfilled internally or the list is empty." />
      ) : (
        <div className="company-order-list">
          {groups.map((group, index) => (
            <details className="company-order" key={group.company?.id || `unknown-${index}`} open={index === 0 && !search}>
              <summary>
                <span className="company-order__icon"><Building2 size={20} /></span>
                <span><strong>{group.company?.name || 'Unknown company'}</strong><small>{group.products.length} required {group.products.length === 1 ? 'product' : 'products'}</small></span>
                <ChevronDown size={19} />
              </summary>
              <div className="company-order__products">
                {group.products.map(({ product, requirements: productRequirements }) => (
                  <article className="order-product" key={product.id}>
                    <div className="order-product__heading"><div><h2>{product.name}</h2><span><Package size={15} />{product.packaging}</span></div>{productRequirements.length > 1 ? <span className="dual-shop-badge">Both shops</span> : null}</div>
                    <div className="shop-quantity-grid">
                      {productRequirements.sort((left, right) => left.requestingShopId.localeCompare(right.requestingShopId)).map((row) => (
                        <div className="company-order-row" key={row.id}>
                          <div className="company-order-row__request"><span>{getShopName(row.requestingShopId)}</span><strong>Requested {row.quantityReference}</strong></div>
                          <label className="company-order-row__quantity">
                            <span>Company will send</span>
                            <input
                              value={companyQuantities[row.id] ?? row.quantityReference}
                              onChange={(event) => setCompanyQuantities((current) => ({ ...current, [row.id]: event.target.value }))}
                              maxLength={40}
                              aria-label={`Company quantity for ${product.name} at ${getShopName(row.requestingShopId)}`}
                            />
                          </label>
                          <button className="button button--success company-order-row__action" type="button" disabled={busyId === row.id} onClick={() => void markAsOrdered(row)}>
                            <CheckCircle2 size={18} />{busyId === row.id ? 'Ordering...' : 'Ordered'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
};
