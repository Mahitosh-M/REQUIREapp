import { ArrowLeft, Building2, Check, ChevronRight, Package, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, FormError, LoadingState, Modal, PageHeader, SearchField, StatusBadge, SubmitButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCatalogue } from '../context/CatalogueContext';
import {
  createProductAndRequirement,
  createRequirement,
  DuplicateRequirementError,
  getFriendlyDataError,
  searchActiveProducts,
  updateRequirementQuantity
} from '../services/dataService';
import type { Company, Product, Requirement } from '../types';
import { createCatalogueKey, normalizeCompanyName, rankProductSearch } from '../utils/normalization';
import { validateQuantityReference } from '../utils/workflow';

export const AddRequirementPage = () => {
  const { profile, actingShopId } = useAuth();
  const { companies, companyMap, loading: companiesLoading, loadProducts, invalidateProducts } = useCatalogue();
  const navigate = useNavigate();
  const [companySearch, setCompanySearch] = useState('');
  const [catalogueMatches, setCatalogueMatches] = useState<Product[]>([]);
  const [catalogueSearchLoading, setCatalogueSearchLoading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPackaging, setNewPackaging] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<Requirement | null>(null);
  const [duplicateQuantity, setDuplicateQuantity] = useState('');

  useEffect(() => {
    if (company || normalizeCompanyName(companySearch).length < 2) {
      setCatalogueMatches([]);
      setCatalogueSearchLoading(false);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setCatalogueSearchLoading(true);
      void searchActiveProducts(companySearch)
        .then((rows) => { if (active) setCatalogueMatches(rows); })
        .catch((loadError) => { if (active) setError(getFriendlyDataError(loadError)); })
        .finally(() => { if (active) setCatalogueSearchLoading(false); });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [company, companySearch]);

  useEffect(() => {
    if (!company) return;
    let active = true;
    setProductsLoading(true);
    void loadProducts(company.id).then((rows) => {
      if (active) setProducts(rows.filter((row) => row.active));
    }).catch((loadError) => {
      if (active) setError(getFriendlyDataError(loadError));
    }).finally(() => {
      if (active) setProductsLoading(false);
    });
    return () => { active = false; };
  }, [company, loadProducts]);

  const companyResults = useMemo(() => {
    const term = normalizeCompanyName(companySearch);
    return companies.filter((row) => row.active && (!term || row.normalizedName.includes(term))).slice(0, 30);
  }, [companies, companySearch]);
  const productResults = useMemo(() => rankProductSearch(products, productSearch).slice(0, 40), [productSearch, products]);

  const handleDuplicate = (caught: DuplicateRequirementError, requestedQuantity: string) => {
    setDuplicate(caught.existing);
    setDuplicateQuantity(requestedQuantity || caught.existing.quantityReference);
  };

  const addExisting = async (event: FormEvent) => {
    event.preventDefault();
    const quantityError = validateQuantityReference(quantity);
    if (!product || !actingShopId || !profile || quantityError) {
      setError(quantityError || 'Select a product.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createRequirement({ productId: product.id, shopId: actingShopId, quantityReference: quantity, createdBy: profile.uid });
      navigate('/required');
    } catch (actionError) {
      if (actionError instanceof DuplicateRequirementError) handleDuplicate(actionError, quantity);
      else setError(getFriendlyDataError(actionError));
    } finally {
      setBusy(false);
    }
  };

  const addNew = async (event: FormEvent) => {
    event.preventDefault();
    const quantityError = validateQuantityReference(quantity);
    if (!company || !actingShopId || !profile || !newName.trim() || !newPackaging.trim() || quantityError) {
      setError(quantityError || 'Product name and packaging are required.');
      return;
    }
    const exact = products.find((row) => row.catalogueKey === createCatalogueKey(newName, newPackaging));
    if (exact) {
      setShowNewProduct(false);
      setProduct(exact);
      setProductSearch(exact.name);
      setError('This product already exists. It has been selected.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createProductAndRequirement({ companyId: company.id, name: newName, packaging: newPackaging }, actingShopId, quantity, profile.uid);
      invalidateProducts(company.id);
      navigate('/required');
    } catch (actionError) {
      if (actionError instanceof DuplicateRequirementError) handleDuplicate(actionError, quantity);
      else setError(getFriendlyDataError(actionError));
    } finally {
      setBusy(false);
    }
  };

  const updateDuplicate = async () => {
    if (!duplicate) return;
    const quantityError = validateQuantityReference(duplicateQuantity);
    if (quantityError) { setError(quantityError); return; }
    setBusy(true);
    try {
      await updateRequirementQuantity(duplicate.id, duplicateQuantity);
      navigate('/required');
    } catch (actionError) {
      setError(getFriendlyDataError(actionError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack add-flow">
      <PageHeader eyebrow="New requirement" title={company ? company.name : 'Select company'} actions={company ? <button className="button button--ghost" type="button" onClick={() => { setCompany(null); setProduct(null); setProductSearch(''); setShowNewProduct(false); }}><ArrowLeft size={18} />Change company</button> : undefined} />
      {!actingShopId ? <FormError message="Choose an operational shop before adding a requirement." /> : null}
      {!company ? (
        <section className="selection-panel">
          <SearchField value={companySearch} onChange={setCompanySearch} placeholder="Search companies or products" label="Search companies or products" />
          {companiesLoading ? <LoadingState label="Loading companies" /> : (
            <>
            <div className="selection-list">
              {companyResults.length ? <p className="selection-list__heading">Companies</p> : null}
              {companyResults.map((row) => <button type="button" key={row.id} onClick={() => { setCompany(row); setCompanySearch(''); }}><span className="selection-icon"><Building2 size={19} /></span><strong>{row.name}</strong><ChevronRight size={18} /></button>)}
              {catalogueMatches.length ? <p className="selection-list__heading">Products</p> : null}
              {catalogueMatches.map((row) => {
                const productCompany = companyMap.get(row.companyId);
                if (!productCompany?.active) return null;
                return (
                  <button type="button" key={row.id} onClick={() => { setCompany(productCompany); setProduct(row); setProductSearch(row.name); setCompanySearch(''); }}>
                    <span className="selection-icon"><Package size={19} /></span>
                    <span className="catalogue-search-result__copy"><strong>{row.name}</strong><small>{productCompany.name} - {row.packaging}</small></span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
              {catalogueSearchLoading ? <p className="selection-empty">Searching products...</p> : null}
              {!companiesLoading && !catalogueSearchLoading && !companyResults.length && !catalogueMatches.length ? <p className="selection-empty">No matching companies or products found.</p> : null}
            </div>
            <FormError message={error} />
            </>
          )}
        </section>
      ) : (
        <section className="selection-panel">
          <div className="step-label"><span>1</span><strong>Search product</strong></div>
          <SearchField value={productSearch} onChange={(value) => { setProductSearch(value); setProduct(null); setShowNewProduct(false); }} placeholder="Product name" label="Search products" />
          {productsLoading ? <LoadingState label="Loading company products" /> : (
            <div className="product-picker">
              {productResults.map((row) => (
                <button type="button" className={product?.id === row.id ? 'is-selected' : ''} key={row.id} onClick={() => { setProduct(row); setProductSearch(row.name); setShowNewProduct(false); setError(''); }}>
                  <span><strong>{row.name}</strong><small><Package size={14} />{row.packaging}</small></span>
                  {row.reviewStatus === 'pending' ? <StatusBadge status="pending" /> : product?.id === row.id ? <Check size={18} /> : <ChevronRight size={18} />}
                </button>
              ))}
            </div>
          )}
          {!productsLoading && productSearch.trim() ? <button className="add-new-product" type="button" onClick={() => { setShowNewProduct(true); setProduct(null); setNewName(productSearch.toUpperCase()); setError(''); }}><Plus size={19} /><span><strong>Add new product</strong><small>Under {company.name}</small></span></button> : null}

          {product && !showNewProduct ? (
            <form className="compact-form form-band" onSubmit={addExisting}>
              <div className="step-label"><span>2</span><strong>Quantity reference</strong></div>
              <Field label="Qty reference"><input value={quantity} onChange={(event) => setQuantity(event.target.value)} maxLength={40} placeholder="Example: 5 boxes" required /></Field>
              <FormError message={error} />
              <SubmitButton busy={busy}>Add requirement</SubmitButton>
            </form>
          ) : null}

          {showNewProduct ? (
            <form className="compact-form form-band" onSubmit={addNew}>
              <div className="step-label"><span>2</span><strong>Create product and requirement</strong></div>
              <div className="form-grid form-grid--2">
                <Field label="Product name"><input className="catalogue-text-input" value={newName} onChange={(event) => setNewName(event.target.value.toUpperCase())} maxLength={160} required /></Field>
                <Field label="Packaging"><input className="catalogue-text-input" value={newPackaging} onChange={(event) => setNewPackaging(event.target.value.toUpperCase())} maxLength={100} placeholder="Example: 10 x 10" required /></Field>
              </div>
              <Field label="Qty reference"><input value={quantity} onChange={(event) => setQuantity(event.target.value)} maxLength={40} placeholder="Example: 5 boxes" required /></Field>
              <FormError message={error} />
              <SubmitButton busy={busy}>Create product and add</SubmitButton>
            </form>
          ) : null}
          {!product && !showNewProduct && !productSearch.trim() ? <div className="selection-placeholder"><Search size={25} /><p>Start typing a product name.</p></div> : null}
        </section>
      )}
      {duplicate ? (
        <Modal title="Requirement already exists" onClose={() => setDuplicate(null)}>
          <div className="modal__body">
            <p>This product already has an active requirement for your shop.</p>
            <div className="existing-quantity"><span>Existing Qty Ref</span><strong>{duplicate.quantityReference}</strong></div>
            <Field label="New Qty reference"><input value={duplicateQuantity} onChange={(event) => setDuplicateQuantity(event.target.value)} maxLength={40} /></Field>
            <FormError message={error} />
          </div>
          <div className="modal__actions">
            <button className="button button--ghost" type="button" onClick={() => setDuplicate(null)}>Cancel</button>
            <button className="button button--primary" type="button" disabled={busy} onClick={() => void updateDuplicate()}>Update Qty reference</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};
