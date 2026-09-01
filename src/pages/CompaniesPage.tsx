import { Building2, Edit3, Plus, Power, PowerOff } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingState, Modal, PageHeader, SearchField, SubmitButton, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCatalogue } from '../context/CatalogueContext';
import { createCompany, getFriendlyDataError, updateCompany } from '../services/dataService';
import type { Company } from '../types';
import { normalizeCompanyName } from '../utils/normalization';

export const CompaniesPage = () => {
  const { profile } = useAuth();
  const { companies, loading, error: loadError, refreshCompanies } = useCatalogue();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [toggling, setToggling] = useState<Company | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const rows = useMemo(() => {
    const term = normalizeCompanyName(search);
    return companies.filter((company) => !term || company.normalizedName.includes(term));
  }, [companies, search]);

  const closeForm = () => { setAdding(false); setEditing(null); setName(''); setError(''); };
  const openEdit = (company: Company) => { setEditing(company); setName(company.name); setError(''); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (editing) await updateCompany(editing, { name });
      else await createCompany(name, profile.uid);
      await refreshCompanies();
      toast(editing ? 'Company updated.' : 'Company added.');
      closeForm();
    } catch (actionError) {
      setError(getFriendlyDataError(actionError));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!toggling) return;
    setBusy(true);
    try {
      await updateCompany(toggling, { active: !toggling.active });
      await refreshCompanies();
      toast(toggling.active ? 'Company deactivated.' : 'Company reactivated.');
      setToggling(null);
    } catch (actionError) {
      toast(getFriendlyDataError(actionError), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Catalogue control" title="Companies" actions={<button className="button button--primary" type="button" onClick={() => { setAdding(true); setName(''); setError(''); }}><Plus size={18} />Add company</button>} />
      <div className="toolbar"><SearchField value={search} onChange={setSearch} placeholder="Search companies" /></div>
      {loading ? <LoadingState label="Loading companies" /> : loadError ? <ErrorState message={loadError} retry={() => void refreshCompanies()} /> : !rows.length ? (
        <EmptyState icon={<Building2 size={30} />} title="No companies found" />
      ) : (
        <div className="management-list">
          {rows.map((company) => (
            <article className={`management-row ${company.active ? '' : 'is-inactive'}`} key={company.id}>
              <span className="management-row__icon"><Building2 size={20} /></span>
              <div><strong>{company.name}</strong><small>{company.active ? 'Active' : 'Inactive'}</small></div>
              <div className="management-row__actions">
                <button className="icon-button" type="button" onClick={() => openEdit(company)} title="Edit company"><Edit3 size={18} /></button>
                <button className={`icon-button ${company.active ? 'icon-button--danger' : 'icon-button--success'}`} type="button" onClick={() => setToggling(company)} title={company.active ? 'Deactivate company' : 'Reactivate company'}>{company.active ? <PowerOff size={18} /> : <Power size={18} />}</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {(adding || editing) ? (
        <Modal title={editing ? 'Edit company' : 'Add company'} onClose={closeForm}>
          <form onSubmit={save}>
            <div className="modal__body"><Field label="Company name"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required autoFocus /></Field><FormError message={error} /></div>
            <div className="modal__actions"><button className="button button--ghost" type="button" onClick={closeForm}>Cancel</button><SubmitButton busy={busy}>{editing ? 'Save changes' : 'Add company'}</SubmitButton></div>
          </form>
        </Modal>
      ) : null}
      {toggling ? (
        <ConfirmDialog
          title={toggling.active ? 'Deactivate company?' : 'Reactivate company?'}
          message={toggling.active ? 'Staff will no longer see this company when adding requirements. Existing products and requirements are not deleted.' : 'Staff will be able to select this company again.'}
          confirmLabel={toggling.active ? 'Deactivate' : 'Reactivate'}
          tone={toggling.active ? 'danger' : 'primary'}
          busy={busy}
          onClose={() => setToggling(null)}
          onConfirm={() => void toggleActive()}
        />
      ) : null}
    </div>
  );
};
