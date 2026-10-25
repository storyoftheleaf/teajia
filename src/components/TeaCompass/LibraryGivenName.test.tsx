import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invalidate: vi.fn().mockResolvedValue(undefined), editor: undefined as undefined | { onSave: (value: string) => Promise<void>; readOnly?: boolean; value: string } }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('./LibraryInlineValue', () => ({ LibraryInlineValue: (props: { display: string; onSave: (value: string) => Promise<void>; value: string }) => {
  mocks.editor = props;
  return <span>{props.display}</span>;
} }));
import { LibraryGivenName } from './LibraryGivenName';
beforeEach(() => { mocks.editor = undefined; mocks.invalidate.mockClear(); });
describe('encounter given name', () => {
  it('offers naming before any inventory product exists', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    expect(renderToStaticMarkup(<LibraryGivenName entry={{}} onSave={save} />)).toContain('Name of the tea');
    await mocks.editor!.onSave('Amber Sky');
    expect(save).toHaveBeenCalledWith('Amber Sky');
  });
  it('replaces legacy repeated titles with an edit action without changing the stored value', () => {
    const save = vi.fn();
    const markup = renderToStaticMarkup(<LibraryGivenName entry={{ name: 'Source tea', givenName: ' Source tea ' }} onSave={save} />);
    expect(markup).toContain('Name of the tea');
    expect(mocks.editor!.value).toBe(' Source tea ');
    expect(save).not.toHaveBeenCalled();
  });
  it('shows and edits the same stored name', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    expect(renderToStaticMarkup(<LibraryGivenName entry={{ givenName: 'Amber Sky' }} onSave={save} />)).toContain('Amber Sky');
    await mocks.editor!.onSave('');
    expect(save).toHaveBeenCalledWith('');
  });
  it('shows a recorded name read-only and hides empty read-only prompts', () => {
    const save = vi.fn();
    expect(renderToStaticMarkup(<LibraryGivenName entry={{}} readOnly onSave={save} />)).toBe('');
    expect(renderToStaticMarkup(<LibraryGivenName entry={{ givenName: 'Amber' }} readOnly onSave={save} />)).toContain('Amber');
    expect(mocks.editor!.readOnly).toBe(true);
  });
  it('refreshes shared Inventory data after a linked name saves', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderToStaticMarkup(<LibraryGivenName entry={{ givenName: 'Amber', draftProductId: 'product' }} onSave={save} />);
    await mocks.editor!.onSave('Gold');
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['products'] });
  });
  it('leaves failed writes to the inline retry control', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Offline'));
    renderToStaticMarkup(<LibraryGivenName entry={{}} onSave={save} />);
    await expect(mocks.editor!.onSave('Amber')).rejects.toThrow('Offline');
  });
});
