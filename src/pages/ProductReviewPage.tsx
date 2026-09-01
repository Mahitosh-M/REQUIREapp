import { CheckCircle2, Edit3, GitMerge, Package, ScanSearch, Store } from 'lucide-react';
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
  StatusBadge,
  SubmitButton,
  useToast
} from '../components/ui';
import { useCatalogue } from '../context/CatalogueContext';
import { getFriendlyDataError, getPendingProducts, mergeProduct, saveProductChanges } from '../services/dataService';
import type { Product } from '../types';
import { getDuplicateCandidates } from '../utils/normalization';
import { getShopName } from '../utils/shops';

export const ProductReviewPage = () => {
  const { companies, companyMap, loadProducts, invalidateProducts } = useCatalogue();
  const [pending, setPending] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [companyProducts, setCompanyProducts] = useState<Product[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [packaging, setPackaging] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const loadPending = async () => {
    setLoading(true);
    try {
      setPending(await getPendingProducts());
      setLoadError('');
    } catch (actionError) {
      setLoadError(getFriendlyDataError(actionError));
    } finally { setLoading(false); }
  };
  useEffect(() => { void loadPending(); }, []);

  const review = async (product: Product) => {
    setSelected(product);
    setName(product.name);
    setPackaging(product.packaging);
    setCompanyId(product.companyId);
    setEditing(false);
    setError('');
    setMatchesLoading(true);
    try {
      setCompanyProducts(await loadProducts(product.companyId, true));
    } catch (actionError) {
      setError(getFriendlyDataError(actionError));
    } finally { setMatchesLoading(false); }
  };

  const candidates = useMemo(() => selected ? getDuplicateCandidates(selected, companyProducts) : [], [companyProducts, selected]);

  const finish = async (message: string, affectedCompanyId: string) => {
    invalidateProducts(affectedCompanyId);
    setSelected(null);
    setEditing(false);
    await loadPending();
    toast(message);
  };

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await saveProductChanges(selected, selected, 'approved');
      await finish('Product approved.', selected.companyId);
    } catch (actionError) { setError(getFriendlyDataError(actionError)); }
    finally { setBusy(false); }
  };

  const editAndApprove = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !name.trim() || !packaging.trim() || !companyId) return;
    setBusy(true);
    try {
      await saveProductChanges(selected, { name, packaging, companyId }, 'approved');
      invalidateProducts(companyId);
      await finish('Product edited and approved.', selected.companyId);
    } catch (actionError) { setError(getFriendlyDataError(actionError)); }
    finally { setBusy(false); }
  };

  const merge = async () => {
    if (!selected || !mergeTarget) return;
    setBusy(true);
    try {
      await mergeProduct(selected, mergeTarget);
      setMergeTarget(null);
      await finish(`Merged into ${mergeTarget.name} (${mergeTarget.packaging}).`, selected.companyId);
    } catch (actionError) { setError(getFriendlyDataError(actionError)); setMergeTarget(null); }
    finally { setBusy(false); }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Catalogue quality" title="Product Review" />
      {loading ? <LoadingState label="Loading pending products" /> : loadError ? <ErrorState message={loadError} retry={() => void loadPending()} /> : !pending.length ? (
        <EmptyState icon={<ScanSearch size={30} />} title="No products pending review" />
      ) : (
        <div className="review-list">
          {pending.map((product) => (
            <article className="review-row" key={product.id}>
              <div><h2>{product.name}</h2><span><Package size={15} />{product.packaging}</span></div>
              <div className="review-row__origin"><strong>{companyMap.get(product.companyId)?.name || 'Unknown company'}</strong><small><Store size={14} />{product.createdByShopId ? `Added by ${getShopName(product.createdByShopId)}` : 'Added by Admin'}</small></div>
              <StatusBadge status="pending" />
              <button className="button button--secondary" type="button" onClick={() => void review(product)}>Review</button>
            </article>
          ))}
        </div>
      )}
      {selected ? (
        <Modal title="Review product" onClose={() => setSelected(null)} wide>
          {!editing ? (
            <>
              <div className="modal__body review-detail">
                <div className="review-product-heading"><div><h3>{selected.name}</h3><span><Package size={16} />{selected.packaging}</span></div><strong>{companyMap.get(selected.companyId)?.name}</strong></div>
                <section className="possible-matches"><h3>Possible matches in this company</h3>
                  {matchesLoading ? <LoadingState label="Checking catalogue" /> : error ? <FormError message={error} /> : !candidates.length ? <p className="selection-empty">No close matches found.</p> : (
                    <div className="candidate-list">{candidates.map(({ product, strength }) => (
                      <div className="candidate-row" key={product.id}><div><strong>{product.name}</strong><small><Package size={14} />{product.packaging}</small></div><span className={`match-label match-label--${strength}`}>{strength === 'strong' ? 'Strong match' : 'Possible'}</span><button className="button button--danger-soft" type="button" onClick={() => setMergeTarget(product)}><GitMerge size={17} />Merge into this</button></div>
                    ))}</div>
                  )}
                </section>
              </div>
              <div className="modal__actions modal__actions--split"><button className="button button--ghost" type="button" onClick={() => setEditing(true)}><Edit3 size={17} />Edit & approve</button><button className="button button--primary" type="button" disabled={busy} onClick={() => void approve()}><CheckCircle2 size={18} />Approve</button></div>
            </>
          ) : (
            <form onSubmit={editAndApprove}>
              <div className="modal__body compact-form">
                <Field label="Company"><select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>{companies.filter((company) => company.active || company.id === companyId).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
                <Field label="Product name"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required autoFocus /></Field>
                <Field label="Packaging"><input value={packaging} onChange={(event) => setPackaging(event.target.value)} maxLength={100} required /></Field>
                <FormError message={error} />
              </div>
              <div className="modal__actions"><button className="button button--ghost" type="button" onClick={() => setEditing(false)}>Back</button><SubmitButton busy={busy}>Save & approve</SubmitButton></div>
            </form>
          )}
        </Modal>
      ) : null}
      {mergeTarget && selected ? (
        <ConfirmDialog title="Merge duplicate product?" message={`All active requirements for ${selected.name} (${selected.packaging}) will move to ${mergeTarget.name} (${mergeTarget.packaging}). The duplicate will be deactivated.`} confirmLabel="Merge product" busy={busy} onClose={() => setMergeTarget(null)} onConfirm={() => void merge()} />
      ) : null}
    </div>
  );
};
