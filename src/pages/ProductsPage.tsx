import { Boxes, CheckCircle2, Edit3, GitMerge, Package, Plus, Power, PowerOff } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  LoadingState,
  Modal,
  PageHeader,
  SearchField,
  SegmentedControl,
  StatusBadge,
  SubmitButton,
  useToast
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCatalogue } from '../context/CatalogueContext';
import {
  createProduct,
  getFriendlyDataError,
  mergeProduct,
  saveProductChanges,
  setProductActive
} from '../services/dataService';
import type { Product, ProductReviewStatus } from '../types';
import { normalizeProductName } from '../utils/normalization';

type ProductFilter = 'all' | 'approved' | 'pending';

interface ProductFormState {
  companyId: string;
  name: string;
  packaging: string;
  reviewStatus: ProductReviewStatus;
}

const emptyForm: ProductFormState = { companyId: '', name: '', packaging: '', reviewStatus: 'approved' };

export const ProductsPage = () => {
  const { profile } = useAuth();
  const { companies, loadProducts, invalidateProducts } = useCatalogue();
  const [companyId, setCompanyId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [toggling, setToggling] = useState<Product | null>(null);
  const [merging, setMerging] = useState<Product | null>(null);
  const [retainedId, setRetainedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const reload = async (targetCompanyId = companyId) => {
    if (!targetCompanyId) return;
    setLoading(true);
    try {
      invalidateProducts(targetCompanyId);
      setProducts(await loadProducts(targetCompanyId, true));
      setLoadError('');
    } catch (actionError) {
      setLoadError(getFriendlyDataError(actionError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (companyId) void reload(companyId); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const term = normalizeProductName(search);
    return products.filter((product) => {
      if (filter !== 'all' && product.reviewStatus !== filter) return false;
      return !term || product.normalizedName.includes(term) || product.normalizedPackaging.includes(term);
    });
  }, [filter, products, search]);

  const openNew = () => {
    setEditing('new');
    setForm({ ...emptyForm, companyId });
    setError('');
  };
  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({ companyId: product.companyId, name: product.name, packaging: product.packaging, reviewStatus: product.reviewStatus });
    setError('');
  };
  const closeForm = () => { setEditing(null); setError(''); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || !form.companyId || !form.name.trim() || !form.packaging.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (editing === 'new') await createProduct(form, form.reviewStatus, profile.uid, null);
      else if (editing) await saveProductChanges(editing, form, form.reviewStatus);
      const previousCompany = editing && editing !== 'new' ? editing.companyId : form.companyId;
      invalidateProducts(previousCompany);
      invalidateProducts(form.companyId);
      if (form.companyId === companyId || previousCompany === companyId) await reload(companyId);
      toast(editing === 'new' ? 'Product added.' : 'Product updated.');
      closeForm();
    } catch (actionError) {
      setError(getFriendlyDataError(actionError));
    } finally {
      setBusy(false);
    }
  };

  const approve = async (product: Product) => {
    setBusy(true);
    try {
      await saveProductChanges(product, product, 'approved');
      await reload();
      toast('Product approved.');
    } catch (actionError) {
      toast(getFriendlyDataError(actionError), 'error');
    } finally { setBusy(false); }
  };

  const toggle = async () => {
    if (!toggling) return;
    setBusy(true);
    try {
      await setProductActive(toggling, !toggling.active);
      await reload();
      toast(toggling.active ? 'Product deactivated.' : 'Product reactivated.');
      setToggling(null);
    } catch (actionError) {
      toast(getFriendlyDataError(actionError), 'error');
    } finally { setBusy(false); }
  };

  const merge = async () => {
    if (!merging || !retainedId) return;
    const retained = products.find((row) => row.id === retainedId);
    if (!retained) return;
    setBusy(true);
    setError('');
    try {
      await mergeProduct(merging, retained);
      await reload();
      toast(`Merged into ${retained.name} (${retained.packaging}).`);
      setMerging(null);
      setRetainedId('');
    } catch (actionError) {
      setError(getFriendlyDataError(actionError));
    } finally { setBusy(false); }
  };

  const mergeCandidates = products.filter((row) => row.active && row.id !== merging?.id);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Catalogue control" title="Products" actions={<button className="button button--primary" type="button" onClick={openNew} disabled={!companyId}><Plus size={18} />Add product</button>} />
      <div className="toolbar toolbar--products">
        <label className="select-field"><span className="sr-only">Company</span><select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setSearch(''); }}><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}{company.active ? '' : ' (Inactive)'}</option>)}</select></label>
        <SearchField value={search} onChange={setSearch} placeholder="Search product or packaging" />
        <SegmentedControl<ProductFilter> label="Review status" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'Pending' }]} />
      </div>
      {loading ? <LoadingState label="Loading products" /> : loadError ? <ErrorState message={loadError} retry={() => void reload()} /> : !companyId ? (
        <EmptyState icon={<Boxes size={30} />} title="Select a company" />
      ) : !rows.length ? <EmptyState icon={<Boxes size={30} />} title="No products found" /> : (
        <div className="product-management-list">
          {rows.map((product) => (
            <article className={`product-management-row ${product.active ? '' : 'is-inactive'}`} key={product.id}>
              <div className="product-management-row__main"><h2>{product.name}</h2><span><Package size={15} />{product.packaging}</span></div>
              <div className="product-management-row__status"><StatusBadge status={!product.active ? 'inactive' : product.reviewStatus} /></div>
              <div className="product-management-row__actions">
                {product.reviewStatus === 'pending' && product.active ? <button className="icon-button icon-button--success" type="button" onClick={() => void approve(product)} disabled={busy} title="Approve product"><CheckCircle2 size={18} /></button> : null}
                <button className="icon-button" type="button" onClick={() => openEdit(product)} title="Edit product"><Edit3 size={18} /></button>
                {product.active ? <button className="icon-button" type="button" onClick={() => { setMerging(product); setRetainedId(''); setError(''); }} title="Merge product"><GitMerge size={18} /></button> : null}
                {!product.mergedIntoProductId ? <button className={`icon-button ${product.active ? 'icon-button--danger' : 'icon-button--success'}`} type="button" onClick={() => setToggling(product)} title={product.active ? 'Deactivate product' : 'Reactivate product'}>{product.active ? <PowerOff size={18} /> : <Power size={18} />}</button> : null}
              </div>
            </article>
          ))}
        </div>
      )}
      {editing ? (
        <Modal title={editing === 'new' ? 'Add product' : 'Edit product'} onClose={closeForm}>
          <form onSubmit={save}>
            <div className="modal__body compact-form">
              <Field label="Company"><select value={form.companyId} onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))} required>{companies.filter((company) => company.active || company.id === form.companyId).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
              <Field label="Product name"><input className="catalogue-text-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value.toUpperCase() }))} maxLength={160} required autoFocus /></Field>
              <Field label="Packaging"><input className="catalogue-text-input" value={form.packaging} onChange={(event) => setForm((current) => ({ ...current, packaging: event.target.value.toUpperCase() }))} maxLength={100} required /></Field>
              <Field label="Review status"><select value={form.reviewStatus} onChange={(event) => setForm((current) => ({ ...current, reviewStatus: event.target.value as ProductReviewStatus }))}><option value="approved">Approved</option><option value="pending">Pending Review</option></select></Field>
              <FormError message={error} />
            </div>
            <div className="modal__actions"><button className="button button--ghost" type="button" onClick={closeForm}>Cancel</button><SubmitButton busy={busy}>Save product</SubmitButton></div>
          </form>
        </Modal>
      ) : null}
      {toggling ? (
        <ConfirmDialog title={toggling.active ? 'Deactivate product?' : 'Reactivate product?'} message={toggling.active ? 'The product cannot be deactivated while it has an active requirement. No catalogue or requirement records will be deleted.' : 'The product will become available in catalogue search again.'} confirmLabel={toggling.active ? 'Deactivate' : 'Reactivate'} tone={toggling.active ? 'danger' : 'primary'} busy={busy} onClose={() => setToggling(null)} onConfirm={() => void toggle()} />
      ) : null}
      {merging ? (
        <Modal title="Merge product" onClose={() => setMerging(null)}>
          <div className="modal__body compact-form">
            <div className="merge-source"><span>Duplicate to remove</span><strong>{merging.name}</strong><small>{merging.packaging}</small></div>
            <Field label="Retain existing product"><select value={retainedId} onChange={(event) => setRetainedId(event.target.value)}><option value="">Select product</option>{mergeCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} - {candidate.packaging}</option>)}</select></Field>
            <FormError message={error} />
          </div>
          <div className="modal__actions"><button className="button button--ghost" type="button" onClick={() => setMerging(null)}>Cancel</button><button className="button button--danger" type="button" disabled={!retainedId || busy} onClick={() => void merge()}><GitMerge size={18} />Merge product</button></div>
        </Modal>
      ) : null}
    </div>
  );
};
