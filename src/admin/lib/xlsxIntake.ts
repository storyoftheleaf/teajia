import ExcelJS from 'exceljs';

export const XLSX_INTAKE_LIMITS = Object.freeze({
  maxFileBytes: 10 * 1024 * 1024,
  maxWorksheets: 5,
  maxDataRows: 5_000,
  maxColumns: 100,
});

type IntakeValue = string | number | boolean | Date | null;
export type IntakeRow = Record<string, IntakeValue>;

function safeCellValue(value: ExcelJS.CellValue): IntakeValue {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return value;
  }
  if ('formula' in value || 'sharedFormula' in value) {
    return safeCellValue(value.result ?? null);
  }
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('hyperlink' in value) return value.text;
  if ('error' in value) return value.error;
  return String(value);
}

export function assertSupportedIntakeFile(filename: string): void {
  if (filename.toLowerCase().endsWith('.xls')) {
    throw new Error('Legacy .xls files are not supported. Save the workbook as .xlsx or CSV and try again.');
  }
}

export async function parseXlsxIntake(bytes: ArrayBuffer): Promise<IntakeRow[]> {
  if (bytes.byteLength > XLSX_INTAKE_LIMITS.maxFileBytes) {
    throw new Error('Workbook exceeds the 10 MB file limit.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(bytes) as unknown as Buffer);

  if (workbook.worksheets.length === 0) throw new Error('Workbook contains no worksheets.');
  if (workbook.worksheets.length > XLSX_INTAKE_LIMITS.maxWorksheets) {
    throw new Error(`Workbook exceeds the ${XLSX_INTAKE_LIMITS.maxWorksheets} worksheets limit.`);
  }

  const sheet = workbook.worksheets[0];
  if (sheet.actualRowCount > XLSX_INTAKE_LIMITS.maxDataRows + 1) {
    throw new Error(`Worksheet exceeds the ${XLSX_INTAKE_LIMITS.maxDataRows.toLocaleString('en-US')} data rows limit.`);
  }
  if (sheet.actualColumnCount > XLSX_INTAKE_LIMITS.maxColumns) {
    throw new Error(`Worksheet exceeds the ${XLSX_INTAKE_LIMITS.maxColumns} columns limit.`);
  }

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column - 1] = String(safeCellValue(cell.value) ?? '').trim();
  });

  const rows: IntakeRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row: IntakeRow = {};
    for (let column = 1; column <= headers.length; column += 1) {
      const header = headers[column - 1];
      if (header) row[header] = safeCellValue(sheet.getCell(rowNumber, column).value) ?? '';
    }
    rows.push(row);
  }
  return rows;
}
