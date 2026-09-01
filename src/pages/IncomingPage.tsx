import { CheckCheck, PackageOpen, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, RequirementCard, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCatalogue } from '../context/CatalogueContext';
import { useRequirements } from '../hooks/useRequirements';
import { getFriendlyDataError, markRequirementNotReceived, markRequirementReceived } from '../services/dataService';
import { sendStaffMobileAlert } from '../services/mobileAlertService';
import type { Requirement } from '../types';
import { getShopName } from '../utils/shops';

export const IncomingPage = () => {
  const { actingShopId, profile } = useAuth();
  const { companyMap } = useCatalogue();
  const { requirements, products, loading, error } = useRequirements('incoming', actingShopId);
  const [confirming, setConfirming] = useState<{ requirement: Requirement; action: 'received' | 'not_received' } | null>(null);
  const [busy, setBusy] = useState(false);
  const knownIncomingIds = useRef<Set<string> | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (loading) return;
    const nextIds = new Set(requirements.map((requirement) => requirement.id));
    const previousIds = knownIncomingIds.current;
    knownIncomingIds.current = nextIds;
    if (!previousIds) return;
    const arrival = requirements.find((requirement) => !previousIds.has(requirement.id));
    if (!arrival) return;

    const message = arrival.companyOrderQuantityReference
      ? 'Company order moved to Incoming.'
      : arrival.sourceShopId
        ? `New item incoming from ${getShopName(arrival.sourceShopId)}.`
        : 'New item moved to Incoming.';
    if (profile?.role === 'staff') {
      void sendStaffMobileAlert({
        title: 'New incoming item',
        body: message,
        tag: `incoming-${arrival.id}`,
        path: '/incoming'
      });
    }
  }, [loading, profile?.role, requirements]);

  const complete = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      if (confirming.action === 'received') {
        await markRequirementReceived(confirming.requirement.id);
        toast('Receipt confirmed. Requirement finished.');
      } else {
        await markRequirementNotReceived(confirming.requirement.id);
      }
      setConfirming(null);
    } catch (actionError) {
      toast(getFriendlyDataError(actionError), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Incoming deliveries" title="Incoming" />
      {loading ? <LoadingState label="Loading incoming items" /> : error ? <ErrorState message={error} /> : !requirements.length ? (
        <EmptyState icon={<PackageOpen size={30} />} title="No incoming items" />
      ) : (
        <div className="card-grid">
          {requirements.map((requirement) => {
            const product = products.get(requirement.productId);
            const isCompanyOrder = Boolean(requirement.companyOrderQuantityReference);
            const sourceName = isCompanyOrder ? 'Company' : getShopName(requirement.sourceShopId);
            const isStaffView = profile?.role === 'staff';
            return (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
                product={product}
                company={product ? companyMap.get(product.companyId) : undefined}
                stamp={{ tone: 'incoming', top: 'Coming', center: sourceName, bottom: 'From' }}
                hideStatus={isStaffView}
                quantityValueOnly={isStaffView}
                layout={isStaffView ? 'staff-stamped' : undefined}
                actions={<>
                  {!isCompanyOrder ? <button className="button button--outgoing" type="button" disabled={busy} onClick={() => setConfirming({ requirement, action: 'not_received' })}><RotateCcw size={18} />Not received</button> : null}
                  <button className="button button--incoming" type="button" disabled={busy} onClick={() => setConfirming({ requirement, action: 'received' })}><CheckCheck size={18} />Received</button>
                </>}
              />
            );
          })}
        </div>
      )}
      {confirming ? (
        <ConfirmDialog
          title={confirming.action === 'received' ? 'Confirm receipt' : 'Not received?'}
          message={confirming.action === 'received'
            ? confirming.requirement.companyOrderQuantityReference
              ? 'The company order will be removed after receipt. Version 1 does not keep completed history.'
              : 'The requirement will be removed after receipt. Version 1 does not keep completed history.'
            : `This item will return to ${getShopName(confirming.requirement.sourceShopId!)} in its To Send list.`}
          confirmLabel={confirming.action === 'received' ? 'Confirm received' : 'Return to sender'}
          tone={confirming.action === 'received' ? 'success' : 'danger'}
          busy={busy}
          onClose={() => setConfirming(null)}
          onConfirm={() => void complete()}
        />
      ) : null}
    </div>
  );
};
