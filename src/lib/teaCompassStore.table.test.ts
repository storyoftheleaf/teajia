import { beforeEach, describe, expect, it } from 'vitest';
import { selectTableEntries, useTeaCompassStore } from './teaCompassStore';

const reset = () => useTeaCompassStore.setState({
  entries: [], pendingEntries: [], activeEntryId: null, sessionEntryIds: [],
  currentSessionId: null, lastCaptureAt: null, lastVendorId: null, lastVendorName: null,
});

describe('Curate v2: the open table', () => {
  beforeEach(reset);

  it('has no rows until a table is started', () => {
    const s = useTeaCompassStore.getState();
    expect(selectTableEntries(s)).toEqual([]);
    s.startNewCaptureOnTable('tea');
    // A blank draft is not a row.
    expect(selectTableEntries(useTeaCompassStore.getState())).toEqual([]);
  });

  it('counts drafts and saved teas, tea and teaware, oldest first', () => {
    const s = useTeaCompassStore.getState();
    s.startNewTable();
    const a = s.startNewCaptureOnTable('tea');
    s.updateEntry(a, { name: 'First', createdAt: '2026-10-01T10:00:00.000Z' });
    s.commitEntry(a); // saved
    const b = useTeaCompassStore.getState().startNewCaptureOnTable('teaware');
    useTeaCompassStore.getState().updateEntry(b, { name: 'Second', createdAt: '2026-10-01T10:05:00.000Z' }); // still a draft
    const c = useTeaCompassStore.getState().startNewCaptureOnTable('tea');
    useTeaCompassStore.getState().updateEntry(c, { priceAmount: 40, createdAt: '2026-10-01T10:10:00.000Z' }); // unnamed, but not empty
    useTeaCompassStore.getState().startNewCaptureOnTable('tea'); // a blank one kept ready
    const rows = selectTableEntries(useTeaCompassStore.getState());
    expect(rows.map((e) => e.id)).toEqual([a, b, c]);
  });

  it('keeps teas from another table out, and a new table starts empty with no vendor', () => {
    const s = useTeaCompassStore.getState();
    s.startNewTable();
    s.setTableVendor('v1', 'Wang');
    const a = s.startNewCaptureOnTable('tea');
    useTeaCompassStore.getState().updateEntry(a, { name: 'Old table' });
    useTeaCompassStore.getState().commitEntry(a);
    expect(selectTableEntries(useTeaCompassStore.getState())).toHaveLength(1);
    useTeaCompassStore.getState().startNewTable();
    expect(selectTableEntries(useTeaCompassStore.getState())).toEqual([]);
    expect(useTeaCompassStore.getState().lastVendorName).toBeNull();
  });

  it('a teas added after six idle hours still belong to the open table', () => {
    const s = useTeaCompassStore.getState();
    s.startNewTable();
    const table = useTeaCompassStore.getState().currentSessionId;
    useTeaCompassStore.setState({ lastCaptureAt: Date.now() - 7 * 60 * 60 * 1000 });
    const a = useTeaCompassStore.getState().startNewCaptureOnTable('tea');
    expect(useTeaCompassStore.getState().currentSessionId).toBe(table);
    useTeaCompassStore.getState().updateEntry(a, { name: 'Late' });
    expect(selectTableEntries(useTeaCompassStore.getState()).map((e) => e.name)).toEqual(['Late']);
  });

  it('naming the vendor fills every tea that has none, and only those', () => {
    const s = useTeaCompassStore.getState();
    s.startNewTable();
    const a = s.startNewCaptureOnTable('tea');
    useTeaCompassStore.getState().updateEntry(a, { name: 'No vendor yet' });
    useTeaCompassStore.getState().commitEntry(a);
    const b = useTeaCompassStore.getState().startNewCaptureOnTable('tea');
    useTeaCompassStore.getState().updateEntry(b, { name: 'Has one', vendorName: 'Somebody Else', vendorId: 'other' });
    useTeaCompassStore.getState().commitEntry(b);
    useTeaCompassStore.getState().setTableVendor(null, 'Wang');
    // The record arrives a moment later: the name-only teas pick up the id.
    useTeaCompassStore.getState().setTableVendor('v1', 'Wang');
    const rows = Object.fromEntries(selectTableEntries(useTeaCompassStore.getState()).map((e) => [e.name, `${e.vendorName}|${e.vendorId}`]));
    expect(rows).toEqual({ 'No vendor yet': 'Wang|v1', 'Has one': 'Somebody Else|other' });
    expect(useTeaCompassStore.getState().lastVendorId).toBe('v1');
  });
});
