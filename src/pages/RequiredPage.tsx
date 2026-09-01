import { CheckCircle2, ClipboardList, Plus, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  RequirementCard,
  SearchField,
  SegmentedControl,
  useToast
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCatalogue } from '../context/CatalogueContext';
import { useRequirements } from '../hooks/useRequirements';
import { getFriendlyDataError, markRequirementAvailable } from '../services/dataService';
import { sendStaffMobileAlert } from '../services/mobileAlertService';
import { normalizeProductName } from '../utils/normalization';
import {
  dismissOtherShopRequirement,
  getRequirementDismissalKey,
  readDismissedOtherShopRequirements
} from '../utils/requirementDismissals';
import { getShopName } from '../utils/shops';
import { canShopSupplyRequirement } from '../utils/workflow';

type RequiredFilter = 'mine' | 'other';

export const RequiredPage = () => {
  const { actingShopId, profile } = useAuth();
  const { companyMap } = useCatalogue();
  const { requirements, products, loading, error } = useRequirements('required');
  const [filter, setFilter] = useState<RequiredFilter>('other');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());
  const knownOtherRequirementIds = useRef<Set<string> | null>(null);
  const toast = useToast();
  const isStaffOtherShop = profile?.role === 'staff' && filter === 'other';

  useEffect(() => {
    if (profile?.role !== 'staff' || !profile.uid) {
      setDismissedKeys(new Set());
      return;
    }
    setDismissedKeys(readDismissedOtherShopRequirements(profile.uid));
  }, [profile?.role, profile?.uid]);

  useEffect(() => {
    if (profile?.role !== 'staff' || !actingShopId || loading) {
      knownOtherRequirementIds.current = null;
      return;
    }

    const otherShopRequirements = requirements.filter((requirement) => requirement.requestingShopId !== actingShopId);
    const nextIds = new Set(otherShopRequirements.map((requirement) => requirement.id));
    const previousIds = knownOtherRequirementIds.current;
    knownOtherRequirementIds.current = nextIds;
    if (!previousIds) return;

    const arrivals = otherShopRequirements.filter((requirement) => !previousIds.has(requirement.id));
    if (!arrivals.length) return;

    const message = arrivals.length === 1
      ? `New requirement from ${getShopName(arrivals[0].requestingShopId)}.`
      : `${arrivals.length} new requirements from ${getShopName(arrivals[0].requestingShopId)}.`;
    void sendStaffMobileAlert({
      title: arrivals.length === 1 ? 'New requirement' : 'New requirements',
      body: message,
      tag: `required-${arrivals.map((requirement) => requirement.id).join('-')}`,
      path: '/required'
    });
  }, [actingShopId, loading, profile?.role, requirements]);

  const rows = useMemo(() => {
    const term = normalizeProductName(search);
    return requirements.filter((requirement) => {
      if (filter === 'mine' && requirement.requestingShopId !== actingShopId) return false;
      if (filter === 'other' && requirement.requestingShopId === actingShopId) return false;
      if (isStaffOtherShop && dismissedKeys.has(getRequirementDismissalKey(requirement))) return false;
      if (!term) return true;
      const product = products.get(requirement.productId);
      const company = product ? companyMap.get(product.companyId) : undefined;
      return product?.normalizedName.includes(term) || company?.normalizedName.includes(term);
    });
  }, [actingShopId, companyMap, dismissedKeys, filter, isStaffOtherShop, products, requirements, search]);

  const makeAvailable = async (requirementId: string) => {
    if (!actingShopId) return;
    setBusyId(requirementId);
    try {
      await markRequirementAvailable(requirementId, actingShopId);
      toast('Moved to your To Send list.');
    } catch (actionError) {
      toast(getFriendlyDataError(actionError), 'error');
    } finally {
      setBusyId('');
    }
  };

  const leaveForCompanyOrdering = (requirement: (typeof requirements)[number]) => {
    if (profile?.role === 'staff' && profile.uid) {
      setDismissedKeys(dismissOtherShopRequirement(profile.uid, requirement));
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Daily workflow" title="Required" actions={<Link className="button button--primary page-add-button" to="/add"><Plus size={18} />Add requirement</Link>} />
      <div className="toolbar toolbar--stack-mobile">
        <SegmentedControl<RequiredFilter>
          label="Requirement view"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'other', label: 'Other shop' }, { value: 'mine', label: 'Mine' }]}
        />
        <SearchField value={search} onChange={setSearch} placeholder="Search product or company" />
      </div>
      {loading ? <LoadingState label="Loading requirements" /> : error ? <ErrorState message={error} /> : !rows.length ? (
        <EmptyState icon={<ClipboardList size={30} />} title={filter === 'other' ? 'No requirements from the other shop' : 'No required items'} />
      ) : (
        <div className="card-grid">
          {rows.map((requirement) => {
            const product = products.get(requirement.productId);
            const canSupply = Boolean(actingShopId && canShopSupplyRequirement(requirement, actingShopId, requirements));
            return (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
                product={product}
                company={product ? companyMap.get(product.companyId) : undefined}
                stamp={isStaffOtherShop ? {
                  tone: 'urgent',
                  top: 'Urgent',
                  center: getShopName(requirement.requestingShopId),
                  bottom: 'Requirement'
                } : undefined}
                hideStatus={isStaffOtherShop}
                quantityValueOnly={isStaffOtherShop}
                layout={isStaffOtherShop ? 'staff-stamped' : undefined}
                actions={canSupply ? (
                  <div className="requirement-card__decision-actions">
                    <button className="button button--success" type="button" disabled={busyId === requirement.id} onClick={() => void makeAvailable(requirement.id)}>
                      <CheckCircle2 size={18} />{busyId === requirement.id ? 'Moving...' : 'Available'}
                    </button>
                    <button className="button button--outgoing" type="button" disabled={busyId === requirement.id} onClick={() => leaveForCompanyOrdering(requirement)}>
                      <XCircle size={18} />Not available
                    </button>
                  </div>
                ) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
