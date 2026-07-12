import Papa from 'papaparse';

const rowText = (row: unknown): string => {
  if (typeof row === 'string') return row.trim();
  if (!row || typeof row !== 'object') return String(row ?? '').trim();
  return Object.values(row as Record<string, unknown>).map(value => String(value ?? '').trim()).filter(Boolean).join(' — ');
};

/** Extracts reviewable text while the original File remains the immutable evidence upload. */
export async function extractImportEvidence(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const textBearing = file.type.startsWith('text/') || ['txt', 'csv', 'json'].includes(extension || '');
  if (!textBearing) return '';
  const exact = await file.text();
  if (extension === 'csv' || file.type === 'text/csv') {
    const matrix = Papa.parse<string[]>(exact, { header: false, skipEmptyLines: true }).data;
    if (!matrix.length) return '';
    const knownHeaders = new Set(['name', 'tea', 'item', 'product', 'description', 'price', 'cost', 'weight', 'quantity', 'qty', 'type', 'category']);
    const first = matrix[0].map(value => value.trim().toLowerCase());
    const hasHeader = first.some(value => knownHeaders.has(value)) && first.every(value => !/^\d+(?:\.\d+)?$/.test(value));
    return matrix.slice(hasHeader ? 1 : 0).map(row => rowText(row)).filter(Boolean).join('\n');
  }
  if (extension === 'json' || file.type === 'application/json') {
    try {
      const parsed = JSON.parse(exact);
      return (Array.isArray(parsed) ? parsed : [parsed]).map(rowText).filter(Boolean).join('\n');
    } catch { return exact; }
  }
  return exact;
}
