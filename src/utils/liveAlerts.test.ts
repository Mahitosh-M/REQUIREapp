import { describe, expect, it } from 'vitest';
import { getAddedRows, getRowIds } from './liveAlerts';

describe('live alert detection', () => {
  it('does not treat the initial listener snapshot as a new alert', () => {
    const initialRows = [{ id: 'existing-one' }, { id: 'existing-two' }];
    expect(getAddedRows(null, initialRows)).toEqual([]);
  });

  it('finds only rows added after the baseline snapshot', () => {
    const existingRows = [{ id: 'existing-one' }, { id: 'existing-two' }];
    const nextRows = [...existingRows, { id: 'new-three' }];

    expect(getAddedRows(getRowIds(existingRows), nextRows)).toEqual([{ id: 'new-three' }]);
  });
});
