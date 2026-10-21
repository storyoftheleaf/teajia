import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkingMaterialReview, type WorkingMaterialReviewProps, type WorkingMaterialResult } from './WorkingMaterialReview';

const result: WorkingMaterialResult = {
  notes: [{ id: 'note-one', kind: 'supplier_claim', text: 'Acquired as over thirty years old.', quote: 'This Shuixian is over thirty years old.', requestId: 'request', sourceId: 'talk', title: 'Shuixian conversation', start: 8, end: 47, attribution: 'supplier', relevance: 'this_tea' }],
  coverage: { sources: 1, characters: 24682, chunks: 3, completedChunks: 3 }, sourceSignature: 'signature',
};
const props = (overrides: Partial<WorkingMaterialReviewProps> = {}): WorkingMaterialReviewProps => ({ result, busy: false, stale: false, selected: [], onToggle: vi.fn(), onAnalyze: vi.fn(), canAnalyze: true, ...overrides });
const html = (overrides: Partial<WorkingMaterialReviewProps> = {}) => renderToStaticMarkup(<WorkingMaterialReview {...props(overrides)} />);
function findElement(node: any, type: string): any {
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === type) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const match = findElement(child, type); if (match) return match; }
}
describe('working material review', () => {
  it('distinguishes source material from the public description and reports complete coverage honestly', () => {
    const rendered = html();
    expect(rendered).toContain('<h3');
    expect(rendered).toContain('Working material');
    expect(rendered).toContain('Choose the notes that should guide the public description.');
    expect(rendered).toContain('All 24,682 characters reviewed in 3 parts');
    expect(rendered).toContain('Supplier’s claim · This tea');
    expect(rendered).not.toContain('Save');
  });
  it('places exact source evidence inside a collapsed native disclosure', () => {
    const tree = WorkingMaterialReview(props()); const disclosure = findElement(tree, 'details');
    expect(disclosure.props.open).toBeUndefined();
    const rendered = html();
    expect(rendered).toContain('Source passage · Shuixian conversation');
    expect(rendered).toContain('<blockquote');
    expect(rendered).toContain(result.notes[0].quote);
  });
  it('renders controlled selection and sends the note id through its checkbox', () => {
    const inputProps = props({ selected: ['note-one'] });
    const checkbox = findElement(WorkingMaterialReview(inputProps), 'input');
    expect(checkbox.props.checked).toBe(true);
    expect(checkbox.props['aria-label']).toBe(`Use ${result.notes[0].text}`);
    checkbox.props.onChange();
    expect(inputProps.onToggle).toHaveBeenCalledWith('note-one');
    expect(html({ selected: ['note-one'] })).toContain('1 selected');
  });
  it('requires refresh before selecting stale or incomplete notes', () => {
    expect(findElement(WorkingMaterialReview(props({ stale: true })), 'input').props.disabled).toBe(true);
    expect(html({ stale: true })).toContain('The source material has changed.');
    const incomplete = { ...result, coverage: { ...result.coverage, completedChunks: 2 } };
    expect(html({ result: incomplete })).toContain('2 of 3 parts reviewed, review incomplete');
    expect(html({ result: incomplete })).not.toContain('All 24,682');
    expect(findElement(WorkingMaterialReview(props({ result: incomplete })), 'input').props.disabled).toBe(true);
  });
  it('keeps ambiguous tea references visibly uncertain', () => {
    expect(html({ result: { ...result, notes: [{ ...result.notes[0], attribution: 'unclear', relevance: 'uncertain' }] } })).toContain('Confirm which tea this refers to before using it.');
  });
  it('exposes analysis, busy, empty and failure states without making any request itself', () => {
    const inputProps = props({ result: undefined });
    findElement(WorkingMaterialReview(inputProps), 'button').props.onClick();
    expect(inputProps.onAnalyze).toHaveBeenCalledOnce();
    expect(html({ result: undefined })).toContain('Review full transcripts');
    expect(html({ result: undefined, canAnalyze: false })).toContain('Link a transcript');
    expect(html({ busy: true })).toContain('aria-busy="true"');
    expect(html({ error: 'Review failed. Try again.' })).toContain('role="alert"');
  });
});
