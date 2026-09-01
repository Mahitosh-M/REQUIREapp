import { useEffect, useRef } from 'react';
import {
  listenIncomingRequirements,
  listenRequiredRequirementsForShop
} from '../services/dataService';
import { sendStaffMobileAlert } from '../services/mobileAlertService';
import type { ShopId } from '../types';
import { getAddedRows, getRowIds } from '../utils/liveAlerts';
import { getOtherShopId, getShopName } from '../utils/shops';

interface StaffMobileAlertOptions {
  staffShopId: ShopId | null;
  listenForRequired: boolean;
  listenForIncoming: boolean;
}

export const useStaffMobileAlerts = ({
  staffShopId,
  listenForRequired,
  listenForIncoming
}: StaffMobileAlertOptions) => {
  const requiredIds = useRef<Set<string> | null>(null);
  const incomingIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    requiredIds.current = null;
    if (!staffShopId || !listenForRequired) return undefined;

    return listenRequiredRequirementsForShop(
      getOtherShopId(staffShopId),
      (rows) => {
        const addedRows = getAddedRows(requiredIds.current, rows);
        requiredIds.current = getRowIds(rows);
        if (!addedRows.length) return;

        const message = addedRows.length === 1
          ? `New requirement from ${getShopName(addedRows[0].requestingShopId)}.`
          : `${addedRows.length} new requirements from ${getShopName(addedRows[0].requestingShopId)}.`;
        void sendStaffMobileAlert({
          title: addedRows.length === 1 ? 'New requirement' : 'New requirements',
          body: message,
          tag: `required-${addedRows.map((row) => row.id).join('-')}`,
          path: '/required'
        });
      },
      () => undefined
    );
  }, [listenForRequired, staffShopId]);

  useEffect(() => {
    incomingIds.current = null;
    if (!staffShopId || !listenForIncoming) return undefined;

    return listenIncomingRequirements(
      staffShopId,
      (rows) => {
        const addedRows = getAddedRows(incomingIds.current, rows);
        incomingIds.current = getRowIds(rows);
        if (!addedRows.length) return;

        const firstIncoming = addedRows[0];
        const sourceName = firstIncoming.companyOrderQuantityReference
          ? 'company'
          : getShopName(firstIncoming.sourceShopId);
        const message = addedRows.length === 1
          ? `New item is coming from ${sourceName}.`
          : `${addedRows.length} new items are coming.`;
        void sendStaffMobileAlert({
          title: addedRows.length === 1 ? 'New incoming item' : 'New incoming items',
          body: message,
          tag: `incoming-${addedRows.map((row) => row.id).join('-')}`,
          path: '/incoming'
        });
      },
      () => undefined
    );
  }, [listenForIncoming, staffShopId]);
};
