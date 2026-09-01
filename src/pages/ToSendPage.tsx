import { PackageX, PlaneTakeoff, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, RequirementCard, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCatalogue } from '../context/CatalogueContext';
import { useRequirements } from '../hooks/useRequirements';
import { getFriendlyDataError, markRequirementNotAvailable, markRequirementSent } from '../services/dataService';
import type { Requirement } from '../types';
import { getOtherShopId, getShopName } from '../utils/shops';

export const ToSendPage = () => {
  const { actingShopId } = useAuth();
  const { companyMap } = useCatalogue();
  const { requirements, products, loading, error } = useRequirements('to_send', actingShopId);
  const [confirming, setConfirming] = useState<Requirement | null>(null);
  const [busyId, setBusyId] = useState('');
  const knownToSendIds = useRef<Set<string> | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (loading) return;
    const nextIds = new Set(requirements.map((requirement) => requirement.id));
    const previousIds = knownToSendIds.current;
    knownToSendIds.current = nextIds;
    if (!previousIds) return;
    const returned = requirements.find((requirement) => !previousIds.has(requirement.id));
    if (returned?.destinationShopId) toast(`Item returned by ${getShopName(returned.destinationShopId)}.`, 'returning');
  }, [loading, requirements, toast]);

  const sent = async (requirement: Requirement) => {
    setBusyId(requirement.id);
    try {
      await markRequirementSent(requirement.id);
      toast(`Sent to ${getShopName(requirement.destinationShopId!)}.`, 'outgoing');
    } catch (actionError) {
      toast(getFriendlyDataError(actionError), 'error');
    } finally {
      setBusyId('');
    }
  };

  const returnToRequired = async () => {
    if (!confirming) return;
    setBusyId(confirming.id);
    try {
      await markRequirementNotAvailable(confirming.id);
      toast('Returned to Required.');
      setConfirming(null);
    } catch (actionError) {
      toast(getFriendlyDataError(actionError), 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow={actingShopId ? `Send to ${getShopName(getOtherShopId(actingShopId))}` : undefined} title="To Send" />
      {loading ? <LoadingState label="Loading packing list" /> : error ? <ErrorState message={error} /> : !requirements.length ? (
        <EmptyState icon={<Send size={30} />} title="No items to send" />
      ) : (
        <div className="card-grid">
          {requirements.map((requirement) => {
            const product = products.get(requirement.productId);
            return (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
                product={product}
                company={product ? companyMap.get(product.companyId) : undefined}
                label={`Send to ${getShopName(requirement.destinationShopId!)}`}
                actions={<>
                  <button className="button button--danger-soft" type="button" onClick={() => setConfirming(requirement)}><PackageX size={18} />Not available</button>
                  <button className="button button--outgoing" type="button" disabled={busyId === requirement.id} onClick={() => void sent(requirement)}><PlaneTakeoff size={18} />{busyId === requirement.id ? 'Sending...' : 'Sent'}</button>
                </>}
              />
            );
          })}
        </div>
      )}
      {confirming ? (
        <ConfirmDialog
          title="Return to Required?"
          message="This item will leave the packing list and return to the shared Required list for company ordering."
          confirmLabel="Return to Required"
          busy={busyId === confirming.id}
          onClose={() => setConfirming(null)}
          onConfirm={() => void returnToRequired()}
        />
      ) : null}
    </div>
  );
};
