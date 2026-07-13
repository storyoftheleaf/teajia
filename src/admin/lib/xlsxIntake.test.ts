import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

async function makeWorkbook(
  configure: (workbook: ExcelJS.Workbook) => void,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  configure(workbook);
  const bytes = await workbook.xlsx.writeBuffer();
  return Uint8Array.from(bytes as unknown as Iterable<number>).buffer;
}

async function loadParser() {
  return import('./xlsxIntake');
}

describe('parseXlsxIntake', () => {
  it('maps the first worksheet header row to records', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Tea');
      sheet.addRow(['Name', 'Origin', 'Price']);
      sheet.addRow(['Ruby 18', 'Taiwan', 24]);
    });

    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).resolves.toEqual([
      { Name: 'Ruby 18', Origin: 'Taiwan', Price: 24 },
    ]);
  });

  it('rejects files above the byte ceiling before parsing', async () => {
    const { parseXlsxIntake, XLSX_INTAKE_LIMITS } = await loadParser();
    const bytes = new ArrayBuffer(XLSX_INTAKE_LIMITS.maxFileBytes + 1);
    await expect(parseXlsxIntake(bytes)).rejects.toThrow(/10 MB/i);
  });

  it('rejects workbooks above the worksheet ceiling', async () => {
    const bytes = await makeWorkbook((workbook) => {
      for (let index = 0; index < 6; index += 1) workbook.addWorksheet(`Sheet ${index + 1}`);
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).rejects.toThrow(/5 worksheets/i);
  });

  it('rejects worksheets above the row ceiling', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Tea');
      for (let row = 0; row < 5_002; row += 1) sheet.addRow([row]);
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).rejects.toThrow(/5,000 data rows/i);
  });

  it('rejects worksheets above the column ceiling', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Tea');
      sheet.addRow(Array.from({ length: 101 }, (_, index) => `Column ${index + 1}`));
      sheet.addRow(Array.from({ length: 101 }, () => 'value'));
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).rejects.toThrow(/100 columns/i);
  });

  it('rejects empty workbooks', async () => {
    const bytes = await makeWorkbook(() => undefined);
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).rejects.toThrow(/no worksheets/i);
  });

  it('returns formula results without exposing formulas', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Tea');
      sheet.addRow(['Name', 'Computed']);
      sheet.addRow(['Ruby 18', { formula: 'HYPERLINK("https://evil.example")', result: 42 }]);
    });
    const { parseXlsxIntake } = await loadParser();
    const rows = await parseXlsxIntake(bytes);
    expect(rows).toEqual([{ Name: 'Ruby 18', Computed: 42 }]);
    expect(JSON.stringify(rows)).not.toContain('HYPERLINK');
  });
});

describe('assertSupportedIntakeFile', () => {
  it('explicitly rejects legacy .xls files', async () => {
    const { assertSupportedIntakeFile } = await loadParser();
    expect(() => assertSupportedIntakeFile('legacy.xls')).toThrow(/legacy \.xls.*not supported.*\.xlsx or CSV/i);
  });
});
