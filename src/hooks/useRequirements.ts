import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getFriendlyDataError,
  getProductsByIds,
  listenAllRequirements,
  listenIncomingRequirements,
  listenRequiredRequirements,
  listenToSendRequirements
} from '../services/dataService';
import type { Product, Requirement, ShopId } from '../types';

type RequirementStream = 'all' | 'required' | 'to_send' | 'incoming';

export const useRequirements = (stream: RequirementStream, shopId?: ShopId | null) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const productRequest = useRef(0);

  useEffect(() => {
    if ((stream === 'to_send' || stream === 'incoming') && !shopId) {
      setRequirements([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const onData = (rows: Requirement[]) => {
      setRequirements(rows);
      setError('');
      setLoading(false);
    };
    const onError = (loadError: Error) => {
      setError(getFriendlyDataError(loadError));
      setLoading(false);
    };
    if (stream === 'required') return listenRequiredRequirements(onData, onError);
    if (stream === 'to_send') return listenToSendRequirements(shopId!, onData, onError);
    if (stream === 'incoming') return listenIncomingRequirements(shopId!, onData, onError);
    return listenAllRequirements(onData, onError);
  }, [shopId, stream]);

  useEffect(() => {
    const activeRequest = ++productRequest.current;
    if (!requirements.length) {
      setProducts(new Map());
      return;
    }
    void getProductsByIds(requirements.map((row) => row.productId))
      .then((nextProducts) => {
        if (activeRequest === productRequest.current) setProducts(nextProducts);
      })
      .catch((loadError) => {
        if (activeRequest === productRequest.current) setError(getFriendlyDataError(loadError));
      });
  }, [requirements]);

  return useMemo(() => ({ requirements, products, loading, error }), [error, loading, products, requirements]);
};
