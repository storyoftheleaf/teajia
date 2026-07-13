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

function mutateFirstCentralEntry(
  source: ArrayBuffer,
  mutate: (view: DataView, offset: number) => void,
): ArrayBuffer {
  const bytes = new Uint8Array(source.slice(0));
  const view = new DataView(bytes.buffer);
  for (let offset = 0; offset <= bytes.byteLength - 4; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      mutate(view, offset);
      return bytes.buffer;
    }
  }
  throw new Error('fixture has no ZIP central-directory entry');
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

  it('rejects a sparse worksheet whose highest row exceeds the ceiling', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Tea');
      sheet.getCell('A1').value = 'Name';
      sheet.getCell('A5002').value = 'hidden past limit';
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

  it('rejects a sparse worksheet whose highest column exceeds the ceiling', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Tea');
      sheet.getCell('A1').value = 'Name';
      sheet.getCell('CW1').value = 'hidden past limit';
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).rejects.toThrow(/100 columns/i);
  });

  it('rejects oversized rows hidden in a secondary worksheet', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const first = workbook.addWorksheet('Tea');
      first.addRow(['Name']);
      first.addRow(['Ruby 18']);
      const hidden = workbook.addWorksheet('Oversized');
      for (let row = 0; row < 5_002; row += 1) hidden.addRow([row]);
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).rejects.toThrow(/Oversized.*5,000 data rows/i);
  });

  it('rejects oversized columns hidden in a secondary worksheet', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const first = workbook.addWorksheet('Tea');
      first.addRow(['Name']);
      first.addRow(['Ruby 18']);
      const hidden = workbook.addWorksheet('Oversized');
      hidden.addRow(Array.from({ length: 101 }, (_, index) => `Column ${index + 1}`));
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).rejects.toThrow(/Oversized.*100 columns/i);
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

  it('preserves data rows after blank row gaps', async () => {
    const bytes = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Tea');
      sheet.getCell('A1').value = 'Name';
      sheet.getCell('A2').value = 'Ruby 18';
      sheet.getCell('A4').value = 'Dong Ding';
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(bytes)).resolves.toEqual([
      { Name: 'Ruby 18' },
      { Name: '' },
      { Name: 'Dong Ding' },
    ]);
  });

  it('rejects oversized files before reading their bytes', async () => {
    let reads = 0;
    const file = {
      size: 10 * 1024 * 1024 + 1,
      arrayBuffer: async () => { reads += 1; return new ArrayBuffer(0); },
    };
    const { readXlsxIntakeFile } = await loadParser();
    await expect(readXlsxIntakeFile(file)).rejects.toThrow(/10 MB/i);
    expect(reads).toBe(0);
  });

  it('rejects ZIPs with too many central-directory entries before decompression', async () => {
    const bytes = await makeWorkbook((workbook) => {
      workbook.addWorksheet('Tea').addRow(['Name']);
    });
    const hostile = new Uint8Array(bytes.slice(0));
    const view = new DataView(hostile.buffer);
    for (let offset = hostile.byteLength - 22; offset >= 0; offset -= 1) {
      if (view.getUint32(offset, true) !== 0x06054b50) continue;
      view.setUint16(offset + 8, 1_001, true);
      view.setUint16(offset + 10, 1_001, true);
      break;
    }
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(hostile.buffer)).rejects.toThrow(/1,000 ZIP entries/i);
  });

  it('rejects excessive aggregate ZIP expansion before decompression', async () => {
    const bytes = await makeWorkbook((workbook) => {
      workbook.addWorksheet('Tea').addRow(['Name']);
    });
    const hostile = mutateFirstCentralEntry(bytes, (view, offset) => {
      view.setUint32(offset + 24, 50 * 1024 * 1024 + 1, true);
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(hostile)).rejects.toThrow(/50 MB uncompressed/i);
  });

  it('rejects excessive ZIP compression ratios before decompression', async () => {
    const bytes = await makeWorkbook((workbook) => {
      workbook.addWorksheet('Tea').addRow(['Name']);
    });
    const hostile = mutateFirstCentralEntry(bytes, (view, offset) => {
      view.setUint32(offset + 20, 1, true);
      view.setUint32(offset + 24, 101, true);
    });
    const { parseXlsxIntake } = await loadParser();
    await expect(parseXlsxIntake(hostile)).rejects.toThrow(/100:1 compression ratio/i);
  });
});

describe('assertSupportedIntakeFile', () => {
  it('explicitly rejects legacy .xls files', async () => {
    const { assertSupportedIntakeFile } = await loadParser();
    expect(() => assertSupportedIntakeFile('legacy.xls')).toThrow(/legacy \.xls.*not supported.*\.xlsx or CSV/i);
  });
});
