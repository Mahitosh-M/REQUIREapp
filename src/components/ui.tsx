import {
  AlertCircle,
  Building2,
  Check,
  LoaderCircle,
  Package,
  PackageCheck,
  Search,
  Store,
  X
} from 'lucide-react';
import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import type { Company, Product, Requirement } from '../types';

export type ToastTone = 'success' | 'error' | 'info' | 'created';
interface Toast { id: number; message: string; tone: ToastTone }
const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

const toastIcon = (tone: ToastTone) => {
  if (tone === 'created') return <PackageCheck size={19} />;
  return tone === 'success' ? <Check size={18} /> : <AlertCircle size={18} />;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600);
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone}`} key={toast.id}>
            <span className="toast__icon">{toastIcon(toast.tone)}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

export const PageHeader = ({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) => (
  <header className="page-header">
    <div>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
    </div>
    {actions ? <div className="page-header__actions">{actions}</div> : null}
  </header>
);

export const SearchField = ({ value, onChange, placeholder, label = 'Search' }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) => (
  <label className="search-field">
    <span className="sr-only">{label}</span>
    <Search size={18} aria-hidden="true" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    {value ? <button type="button" className="icon-button icon-button--small" onClick={() => onChange('')} title="Clear search"><X size={16} /></button> : null}
  </label>
);

export const LoadingState = ({ label = 'Loading' }: { label?: string }) => (
  <div className="state-panel" role="status"><LoaderCircle className="spin" size={25} /><p>{label}</p></div>
);

export const EmptyState = ({ icon, title, detail }: { icon?: ReactNode; title: string; detail?: string }) => (
  <div className="state-panel state-panel--empty">
    {icon || <Package size={30} />}
    <h2>{title}</h2>
    {detail ? <p>{detail}</p> : null}
  </div>
);

export const ErrorState = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div className="state-panel state-panel--error" role="alert">
    <AlertCircle size={28} /><h2>Something went wrong</h2><p>{message}</p>
    {retry ? <button className="button button--secondary" type="button" onClick={retry}>Try again</button> : null}
  </div>
);

export const StatusBadge = ({ status }: { status: 'required' | 'to_send' | 'incoming' | 'approved' | 'pending' | 'inactive' }) => {
  const labels = { required: 'Required', to_send: 'To Send', incoming: 'Incoming', approved: 'Approved', pending: 'Pending Review', inactive: 'Inactive' };
  return <span className={`status-badge status-badge--${status}`}>{labels[status]}</span>;
};

const RecordStamp = ({ stamp }: { stamp: { tone: 'incoming' | 'urgent'; top: string; center: string; bottom: string } }) => {
  const label = `${stamp.top} ${stamp.center} ${stamp.bottom}`;
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const filterId = `record-stamp-distress-${instanceId}`;
  const topArcId = `record-stamp-top-arc-${instanceId}`;
  const bottomArcId = `record-stamp-bottom-arc-${instanceId}`;
  const pointOnCircle = (radius: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return `${180 + radius * Math.cos(radians)} ${180 + radius * Math.sin(radians)}`;
  };
  const createArc = (radius: number, startAngle: number, endAngle: number, sweep: 0 | 1) => (
    `M ${pointOnCircle(radius, startAngle)} A ${radius} ${radius} 0 0 ${sweep} ${pointOnCircle(radius, endAngle)}`
  );
  const topBandAngle = Math.min(104, Math.max(48, stamp.top.length * 7 + 20));
  const bottomBandAngle = Math.min(104, Math.max(48, stamp.bottom.length * 7 + 20));
  const topWordBackdrop = createArc(126, 270 - topBandAngle / 2, 270 + topBandAngle / 2, 1);
  const bottomWordBackdrop = createArc(142, 90 + bottomBandAngle / 2, 90 - bottomBandAngle / 2, 0);

  return (
    <span className={`record-stamp record-stamp--${stamp.tone}`} role="img" aria-label={label}>
      <svg className="record-stamp__svg" viewBox="0 0 360 360" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} x="-14%" y="-14%" width="128%" height="128%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" seed="17" result="stampNoise" />
            <feDisplacementMap in="SourceGraphic" in2="stampNoise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <path id={topArcId} d="M 54 180 A 126 126 0 0 1 306 180" />
          <path id={bottomArcId} d="M 38 180 A 142 142 0 0 0 322 180" />
        </defs>
        <g className="record-stamp__art" filter={`url(#${filterId})`}>
          <circle className="record-stamp__outer-frame" cx="180" cy="180" r="165" />
          <circle className="record-stamp__secondary-frame" cx="180" cy="180" r="104" />
          <path className="record-stamp__word-backdrop" d={topWordBackdrop} />
          <path className="record-stamp__word-backdrop" d={bottomWordBackdrop} />
          <text className="record-stamp__curve-text">
            <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">{stamp.top.toUpperCase()}</textPath>
          </text>
          <text className="record-stamp__curve-text">
            <textPath href={`#${bottomArcId}`} startOffset="50%" textAnchor="middle">{stamp.bottom.toUpperCase()}</textPath>
          </text>
          <g className="record-stamp__banner-group" transform="rotate(-8 180 180)">
            <rect className="record-stamp__banner-plate" x="8" y="137" width="344" height="86" rx="2" />
            <rect className="record-stamp__banner-inset" x="17" y="146" width="326" height="68" rx="1" />
            <text className="record-stamp__banner-text" x="180" y="196" textAnchor="middle">{stamp.center.toUpperCase()}</text>
          </g>
        </g>
      </svg>
    </span>
  );
};

export const RequirementCard = ({ requirement, product, company, actions, label, stamp, hideStatus = false, quantityValueOnly = false, layout }: {
  requirement: Requirement;
  product?: Product;
  company?: Company;
  actions?: ReactNode;
  label?: string;
  stamp?: { tone: 'incoming' | 'urgent'; top: string; center: string; bottom: string };
  hideStatus?: boolean;
  quantityValueOnly?: boolean;
  layout?: 'staff-stamped';
}) => (
  <article className={`requirement-card requirement-card--${requirement.status}${layout ? ` requirement-card--${layout}` : ''}`}>
    <div className="requirement-card__top">
      <div className="product-title">
        <h2>{product?.name || 'Product unavailable'}</h2>
        <div className="product-details">
          <span className="packaging"><Package size={15} /> {product?.packaging || 'Unknown packaging'}</span>
          <span className="company-name"><Building2 size={15} /> {company?.name || 'Unknown company'}</span>
        </div>
      </div>
      {!hideStatus ? <div className="requirement-card__status"><StatusBadge status={requirement.status} /></div> : null}
    </div>
    {stamp ? <RecordStamp stamp={stamp} /> : null}
    {label ? <div className="requirement-meta"><span><Store size={15} /> {label}</span></div> : null}
    <div className={`quantity-line${quantityValueOnly ? ' quantity-line--value-only' : ''}`}>
      {quantityValueOnly ? <strong>{requirement.quantityReference}</strong> : <><span>Qty reference</span><strong>{requirement.quantityReference}</strong></>}
    </div>
    {requirement.companyOrderQuantityReference ? <div className="company-order-quantity"><span>Company will send</span><strong>{requirement.companyOrderQuantityReference}</strong></div> : null}
    {actions ? <div className="card-actions">{actions}</div> : null}
  </article>
);

export const SegmentedControl = <T extends string>({ options, value, onChange, label }: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) => (
  <div className="segmented" role="group" aria-label={label}>
    {options.map((option) => <button type="button" className={option.value === value ? 'is-active' : ''} aria-pressed={option.value === value} key={option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
);

export const Modal = ({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) => {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal__header"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} title="Close"><X size={20} /></button></header>
        {children}
      </section>
    </div>
  );
};

export const ConfirmDialog = ({ title, message, confirmLabel, tone = 'danger', busy = false, onConfirm, onClose }: {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary' | 'success';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <Modal title={title} onClose={onClose}>
    <div className="modal__body"><p>{message}</p></div>
    <div className="modal__actions">
      <button className="button button--ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
      <button className={`button button--${tone}`} type="button" onClick={onConfirm} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : null}{confirmLabel}</button>
    </div>
  </Modal>
);

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
);

export const SubmitButton = ({ busy, children, className = '' }: { busy: boolean; children: ReactNode; className?: string }) => (
  <button className={`button button--primary ${className}`} type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : null}{children}</button>
);

export const FormError = ({ message }: { message: string }) => message ? <p className="form-error" role="alert"><AlertCircle size={16} />{message}</p> : null;

export const MetricTile = ({ icon, value, label }: { icon: ReactNode; value: number; label: string }) => (
  <div className="metric-tile"><span className="metric-tile__icon">{icon}</span><strong>{value}</strong><span>{label}</span></div>
);

export const formatDate = (value: { toDate?: () => Date } | undefined) => value?.toDate
  ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(value.toDate())
  : '';
