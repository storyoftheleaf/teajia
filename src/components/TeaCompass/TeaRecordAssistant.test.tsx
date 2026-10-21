import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TeaRecordAssistant } from './TeaRecordAssistant';
import { createEmptyEntry } from './types';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';

const originalApp = useAppStore.getState();
const originalCompass = useTeaCompassStore.getState();
afterEach(() => { useAppStore.setState(originalApp); useTeaCompassStore.setState(originalCompass); });

describe('tea record assistant', () => {
  it('offers an honest empty state without a model request or automatic field changes', () => {
    const entry = { ...createEmptyEntry('tea'), id: 'tea-1' };
    useAppStore.setState({ activeAccountId: 'account-1', activeUserId: 'user-1' });
    useTeaCompassStore.setState({ accountScopeId: 'account-1', accountScopeRevision: 1, entries: [entry] });
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MemoryRouter><TeaRecordAssistant entry={entry} /></MemoryRouter></QueryClientProvider>);
    expect(html).toContain('Find tea details');
    expect(html).toContain('No notes or transcripts yet');
    expect(html).toContain('disabled');
    expect(html).not.toContain('Apply reviewed details');
    expect(html).not.toContain('Original material');
    expect(useTeaCompassStore.getState().getEntry(entry.id)?.year).toBeUndefined();
  });
});
