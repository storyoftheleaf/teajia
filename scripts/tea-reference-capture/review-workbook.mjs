import fs from 'node:fs/promises';
import path from 'node:path';

const DECISIONS = Object.freeze(['Accept candidate', 'Needs research', 'Rename', 'Merge', 'Hold', 'Exclude']);
const COLORS = Object.freeze({
  ink: '#2F352B', sage: '#6D7B5C', cream: '#F5F1E7', pale: '#FBF9F3', gold: '#B59052', white: '#FFFFFF', held: '#FFF3D6', line: '#D8D2C4', danger: '#8C3A2B',
});

function scalar(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function columnName(index) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function sourceMap(capture) {
  return new Map(capture.sources.map((packet) => [packet.source.sourceId, packet]));
}

function findConflicts(claims) {
  const groups = new Map();
  for (const claim of claims) {
    if (claim.predicate === 'source_description') continue;
    const key = [claim.entityKind, claim.subject, claim.predicate].join('\u001f');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(claim);
  }
  const conflicts = [];
  for (const [key, group] of groups) {
    const values = new Set(group.map(({ value }) => JSON.stringify(value)));
    if (values.size < 2) continue;
    const conflictId = `CONFLICT-${Buffer.from(key).toString('hex').slice(0, 16).toUpperCase()}`;
    for (const claim of group) conflicts.push({ conflictId, ...claim });
  }
  return conflicts.sort((left, right) => left.conflictId.localeCompare(right.conflictId) || left.claimId.localeCompare(right.claimId));
}

function coverageRows(claims) {
  const groups = new Map();
  for (const claim of claims) {
    const key = `${claim.entityKind}\u001f${claim.claimScope}`;
    if (!groups.has(key)) groups.set(key, { entityKind: claim.entityKind, claimScope: claim.claimScope, claims: 0, held: 0, subjects: new Set() });
    const group = groups.get(key);
    group.claims += 1;
    group.held += claim.status === 'held' ? 1 : 0;
    group.subjects.add(claim.subject);
  }
  return [...groups.values()].sort((left, right) => left.entityKind.localeCompare(right.entityKind) || left.claimScope.localeCompare(right.claimScope));
}

function styleTable(sheet, rows, widths, { decisionColumn = null, heldRows = false, tableName }) {
  const rowCount = Math.max(rows.length, 2);
  const columnCount = rows[0].length;
  const lastColumn = columnName(columnCount - 1);
  if (rows.length === 1) rows.push(Array(columnCount).fill(''));
  const range = sheet.getRange(`A1:${lastColumn}${rows.length}`);
  range.values = rows;
  range.format = {
    font: { name: 'Aptos', size: 10, color: COLORS.ink },
    fill: COLORS.pale,
    verticalAlignment: 'top',
    wrapText: true,
    borders: { insideHorizontal: { style: 'thin', color: COLORS.line }, bottom: { style: 'thin', color: COLORS.line } },
  };
  const header = sheet.getRange(`A1:${lastColumn}1`);
  header.format = {
    fill: COLORS.ink,
    font: { name: 'Aptos', size: 10, bold: true, color: COLORS.white },
    verticalAlignment: 'center',
    wrapText: true,
    rowHeight: 30,
  };
  const table = sheet.tables.add(`A1:${lastColumn}${rows.length}`, true, tableName);
  table.showFilterButton = true;
  table.showBandedRows = true;
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rowCount, 1).format.columnWidth = width;
  });
  if (decisionColumn !== null && rows.length > 1) {
    const letter = columnName(decisionColumn);
    sheet.getRange(`${letter}2:${letter}${Math.max(rows.length, 200)}`).dataValidation = { rule: { type: 'list', values: [...DECISIONS] } };
    sheet.getRange(`${letter}2:${letter}${rows.length}`).format.fill = COLORS.held;
  }
  if (heldRows && rows.length > 1) sheet.getRange(`A2:${lastColumn}${rows.length}`).format.fill = COLORS.held;
}

function makeStartSheet(sheet, capture) {
  sheet.showGridLines = false;
  sheet.getRange('A1:F1').merge();
  sheet.getRange('A1').values = [['Tea Reference capture review']];
  sheet.getRange('A1:F1').format = { fill: COLORS.ink, font: { name: 'Aptos Display', size: 20, bold: true, color: COLORS.white }, rowHeight: 40, verticalAlignment: 'center' };
  sheet.getRange('A3:B8').values = [
    ['Batch status', capture.manifest.complete ? 'Complete capture' : 'Incomplete - source errors present'],
    ['Sources captured', null],
    ['Claim drafts', null],
    ['Held claims', null],
    ['Source errors', capture.manifest.errorCount ?? capture.errors.length],
    ['Preview change', `+${capture.preview.added} added / ${capture.preview.changed} changed / ${capture.preview.missing} missing`],
  ];
  const sourceEnd = Math.max(2, capture.sources.length + 1);
  const claimEnd = Math.max(2, capture.claims.length + 1);
  sheet.getRange('B4').formulas = [[`=COUNTA('SOURCES'!A2:A${sourceEnd})`]];
  sheet.getRange('B5').formulas = [[`=COUNTA('CLAIMS'!A2:A${claimEnd})`]];
  sheet.getRange('B6').formulas = [[`=COUNTIF('CLAIMS'!M2:M${claimEnd},"held")`]];
  sheet.getRange('A3:A8').format = { fill: COLORS.cream, font: { bold: true, color: COLORS.ink }, borders: { bottom: { style: 'thin', color: COLORS.line } } };
  sheet.getRange('B3:B8').format = { fill: COLORS.pale, font: { color: COLORS.ink }, borders: { bottom: { style: 'thin', color: COLORS.line } } };
  sheet.getRange('A10:F10').merge();
  sheet.getRange('A10').values = [['How to review']];
  sheet.getRange('A10:F10').format = { fill: COLORS.sage, font: { bold: true, color: COLORS.white }, rowHeight: 26 };
  sheet.getRange('A11:F16').merge(true);
  sheet.getRange('A11:A16').values = [
    ['1. Read CLAIMS and HELD. Every draft keeps its source URL and exact evidence ID.'],
    ['2. Use Adrian decision: Accept candidate, Needs research, Rename, Merge, Hold, or Exclude.'],
    ['3. “Accept candidate” means suitable for later private verification; it does not publish or assimilate anything.'],
    ['4. Specialist descriptions stay attributed. They do not become Adrian tasting notes.'],
    ['5. One-source claims are flags for research, not automatic rejections. Contradictions remain side by side.'],
    ['6. Nothing in this workbook changes the website, inventory, products, or Wisdom corpus.'],
  ];
  sheet.getRange('A11:F16').format = { fill: COLORS.pale, font: { color: COLORS.ink }, wrapText: true, rowHeight: 30, verticalAlignment: 'center' };
  sheet.getRange('A18:F18').merge();
  sheet.getRange('A18').values = [['Evidence rule: exact private source text may be retained for audit; public use requires citations and only minimal excerpts unless reuse rights allow more.']];
  sheet.getRange('A18:F18').format = { fill: COLORS.held, font: { italic: true, color: COLORS.danger }, wrapText: true, rowHeight: 42 };
  sheet.getRange('A1:F18').format.font = { name: 'Aptos', color: COLORS.ink };
  sheet.getRange('A1:F1').format.font = { name: 'Aptos Display', size: 20, bold: true, color: COLORS.white };
  sheet.getRange('A10:F10').format.font = { name: 'Aptos', size: 11, bold: true, color: COLORS.white };
  sheet.getRange('A1:A18').format.columnWidth = 30;
  sheet.getRange('B1:F18').format.columnWidth = 18;
  sheet.freezePanes.freezeRows(1);
}

export async function writeReviewWorkbook({ capture, outputPath, artifactTool }) {
  if (!artifactTool?.Workbook || !artifactTool?.SpreadsheetFile) throw new Error('The bundled artifact workbook runtime is required');
  const { Workbook, SpreadsheetFile } = artifactTool;
  const workbook = Workbook.create();
  const sheets = Object.fromEntries(['START HERE', 'SOURCES', 'EVIDENCE', 'CLAIMS', 'HELD', 'CONFLICTS', 'COVERAGE']
    .map((name) => [name, workbook.worksheets.add(name)]));
  makeStartSheet(sheets['START HERE'], capture);
  const sources = sourceMap(capture);

  const sourceRows = [['Source ID', 'Publisher', 'Publisher role', 'Publisher qualifications', 'Page title', 'Author', 'Published date', 'Accessed date', 'URL', 'Original hash', 'Normalized hash', 'Capture status']];
  for (const packet of capture.sources) sourceRows.push([
    packet.source.sourceId, packet.source.publisher, packet.source.publisherRole, packet.source.publisherQualifications || '', packet.metadata.title || '',
    packet.metadata.author || '', packet.metadata.publishedDate || '', packet.retrieval.accessedDate || '', packet.source.url,
    packet.retrieval.originalSha256, packet.retrieval.normalizedSha256, 'captured',
  ]);
  for (const error of capture.errors) sourceRows.push([error.sourceId, '', '', '', '', '', '', '', error.url, '', '', `error: ${error.message}`]);
  styleTable(sheets.SOURCES, sourceRows, [20, 24, 20, 30, 28, 22, 14, 14, 44, 34, 34, 28], { tableName: 'SourcesTable' });

  const evidenceRows = [['Evidence ID', 'Source ID', 'Source URL', 'Heading', 'Section', 'Exact source text', 'Start', 'End', 'Excerpt hash']];
  for (const item of capture.evidence) evidenceRows.push([
    item.evidenceId, item.sourceId, sources.get(item.sourceId)?.source.url || '', item.heading || '', item.section || '', item.exact,
    item.start, item.end, item.excerptSha256,
  ]);
  styleTable(sheets.EVIDENCE, evidenceRows, [28, 20, 44, 20, 20, 70, 10, 10, 34], { tableName: 'EvidenceTable' });

  const claimHeader = ['Claim ID', 'Source ID', 'Source URL', 'Evidence ID', 'Subject', 'Entity kind', 'Claim scope', 'Predicate', 'Value', 'Source term', 'Asserting role', 'Payload hash', 'Status', 'Uncertainty / hold reason', 'Idempotency key', 'Adrian decision'];
  const claimRow = (claim) => [
    claim.claimId, claim.sourceId, sources.get(claim.sourceId)?.source.url || '', claim.evidenceId, claim.subject, claim.entityKind,
    claim.claimScope, claim.predicate, scalar(claim.value), claim.sourceTerm || '', claim.assertingPublisherRole, claim.payloadSha256,
    claim.status, claim.uncertaintyReason || '', claim.idempotencyKey || '', '',
  ];
  const claimRows = [claimHeader, ...capture.claims.map(claimRow)];
  styleTable(sheets.CLAIMS, claimRows, [28, 20, 44, 28, 24, 18, 22, 24, 56, 20, 20, 34, 14, 48, 52, 22], { tableName: 'ClaimsTable', decisionColumn: 15 });

  const heldRows = [claimHeader, ...capture.claims.filter(({ status }) => status === 'held').map(claimRow)];
  styleTable(sheets.HELD, heldRows, [28, 20, 44, 28, 24, 18, 22, 24, 56, 20, 20, 34, 14, 48, 52, 22], { tableName: 'HeldTable', decisionColumn: 15, heldRows: true });

  const conflictRows = [['Conflict group', 'Claim ID', 'Subject', 'Entity kind', 'Predicate', 'Value', 'Source ID', 'Source URL', 'Evidence ID', 'Status', 'Adrian decision']];
  for (const conflict of findConflicts(capture.claims)) conflictRows.push([
    conflict.conflictId, conflict.claimId, conflict.subject, conflict.entityKind, conflict.predicate, scalar(conflict.value), conflict.sourceId,
    sources.get(conflict.sourceId)?.source.url || '', conflict.evidenceId, conflict.status, '',
  ]);
  styleTable(sheets.CONFLICTS, conflictRows, [24, 28, 24, 18, 24, 50, 20, 44, 28, 14, 22], { tableName: 'ConflictsTable', decisionColumn: 10, heldRows: true });

  const coverage = [['Entity kind', 'Claim scope', 'Unique subjects', 'Claim drafts', 'Held claims']];
  for (const group of coverageRows(capture.claims)) coverage.push([group.entityKind, group.claimScope, group.subjects.size, group.claims, group.held]);
  styleTable(sheets.COVERAGE, coverage, [24, 28, 18, 18, 18], { tableName: 'CoverageTable' });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  return workbook;
}

export { DECISIONS, findConflicts };
