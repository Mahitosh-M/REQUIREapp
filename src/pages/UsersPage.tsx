import { Edit3, Plus, ShieldCheck, Store, UserCheck, UserRound, UserX } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  LoadingState,
  Modal,
  PageHeader,
  SubmitButton,
  useToast
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { createManagedUser, getFriendlyAuthError } from '../services/authService';
import { getFriendlyDataError, getUsers, updateUserProfile } from '../services/dataService';
import type { AppUser, ShopId, UserRole } from '../types';
import { getShopName, SHOP_OPTIONS } from '../utils/shops';

interface NewUserForm {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  shopId: ShopId | null;
}

const initialForm: NewUserForm = { email: '', password: '', name: '', role: 'staff', shopId: 'SHOP_A' };

export const UsersPage = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [toggling, setToggling] = useState<AppUser | null>(null);
  const [form, setForm] = useState<NewUserForm>(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try { setUsers(await getUsers()); setLoadError(''); }
    catch (actionError) { setLoadError(getFriendlyDataError(actionError)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const openAdd = () => { setAdding(true); setForm(initialForm); setError(''); };
  const openEdit = (user: AppUser) => {
    setEditing(user);
    setForm({ email: user.email, password: '', name: user.name, role: user.role, shopId: user.shopId });
    setError('');
  };
  const close = () => { setAdding(false); setEditing(null); setError(''); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (form.role === 'staff' && !form.shopId) { setError('Assign staff to a shop.'); return; }
    setBusy(true);
    setError('');
    try {
      if (adding) {
        await createManagedUser(form);
        toast('Authentication account and access profile created.');
      } else if (editing) {
        await updateUserProfile(editing, { name: form.name, role: form.role, shopId: form.shopId });
        toast('User access updated.');
      }
      await load();
      close();
    } catch (actionError) {
      setError(adding ? getFriendlyAuthError(actionError) : getFriendlyDataError(actionError));
    } finally { setBusy(false); }
  };

  const toggle = async () => {
    if (!toggling) return;
    setBusy(true);
    try {
      await updateUserProfile(toggling, { active: !toggling.active });
      await load();
      toast(toggling.active ? 'User access deactivated.' : 'User access reactivated.');
      setToggling(null);
    } catch (actionError) { toast(getFriendlyDataError(actionError), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Access control" title="Users" actions={<button className="button button--primary" type="button" onClick={openAdd}><Plus size={18} />Add user</button>} />
      {loading ? <LoadingState label="Loading users" /> : loadError ? <ErrorState message={loadError} retry={() => void load()} /> : !users.length ? (
        <EmptyState icon={<UserRound size={30} />} title="No user profiles" />
      ) : (
        <div className="user-list">
          {users.map((user) => (
            <article className={`user-row ${user.active ? '' : 'is-inactive'}`} key={user.id}>
              <span className="user-row__avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <div className="user-row__identity"><strong>{user.name}</strong><span>{user.email}</span></div>
              <div className="user-row__assignment">{user.role === 'admin' ? <ShieldCheck size={16} /> : <Store size={16} />}<span>{user.role === 'admin' ? 'Admin' : user.shopId ? getShopName(user.shopId) : 'Unassigned'}</span></div>
              <span className={`access-label ${user.active ? 'is-active' : ''}`}>{user.active ? 'Active' : 'Inactive'}</span>
              <div className="management-row__actions">
                <button className="icon-button" type="button" onClick={() => openEdit(user)} title="Edit user"><Edit3 size={18} /></button>
                <button className={`icon-button ${user.active ? 'icon-button--danger' : 'icon-button--success'}`} type="button" disabled={user.uid === profile?.uid} onClick={() => setToggling(user)} title={user.uid === profile?.uid ? 'Your own access must stay active' : user.active ? 'Deactivate user' : 'Reactivate user'}>{user.active ? <UserX size={18} /> : <UserCheck size={18} />}</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {(adding || editing) ? (
        <Modal title={adding ? 'Add user' : 'Edit user'} onClose={close}>
          <form onSubmit={save}>
            <div className="modal__body compact-form">
              <Field label="Name"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} required autoFocus /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} disabled={!adding} required /></Field>
              {adding ? <Field label="Temporary password" hint="At least 6 characters"><input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} minLength={6} required autoComplete="new-password" /></Field> : null}
              <Field label="Role"><select value={form.role} disabled={editing?.uid === profile?.uid} onChange={(event) => { const role = event.target.value as UserRole; setForm((current) => ({ ...current, role, shopId: role === 'staff' ? current.shopId || 'SHOP_A' : current.shopId })); }}><option value="staff">Staff</option><option value="admin">Admin</option></select></Field>
              <Field label={form.role === 'staff' ? 'Assigned shop' : 'Default operational shop'}><select value={form.shopId || ''} onChange={(event) => setForm((current) => ({ ...current, shopId: (event.target.value || null) as ShopId | null }))}>{form.role === 'admin' ? <option value="">No default</option> : null}{SHOP_OPTIONS.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></Field>
              <FormError message={error} />
            </div>
            <div className="modal__actions"><button className="button button--ghost" type="button" onClick={close}>Cancel</button><SubmitButton busy={busy}>{adding ? 'Create user' : 'Save access'}</SubmitButton></div>
          </form>
        </Modal>
      ) : null}
      {toggling ? <ConfirmDialog title={toggling.active ? 'Deactivate user?' : 'Reactivate user?'} message={toggling.active ? 'The account will no longer be able to open REQUIREapp. Authentication credentials are not deleted.' : 'The account will regain access using its existing credentials.'} confirmLabel={toggling.active ? 'Deactivate' : 'Reactivate'} tone={toggling.active ? 'danger' : 'primary'} busy={busy} onClose={() => setToggling(null)} onConfirm={() => void toggle()} /> : null}
    </div>
  );
};
