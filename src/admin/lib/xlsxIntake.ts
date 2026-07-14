import ExcelJS from 'exceljs';
import { strFromU8, Unzip, UnzipInflate } from 'fflate';

export const XLSX_INTAKE_LIMITS = Object.freeze({
  maxFileBytes: 10 * 1024 * 1024,
  maxWorksheets: 5,
  maxDataRows: 5_000,
  maxColumns: 100,
  maxZipEntries: 1_000,
  maxUncompressedBytes: 50 * 1024 * 1024,
  maxCompressionRatio: 100,
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

interface ZipPreflight {
  entriesByLocalOffset: Array<{
    compressedBytes: number;
    name: string;
    usesDataDescriptor: boolean;
    localHeaderOffset: number;
  }>;
  totalCompressedBytes: number;
}

function preflightXlsxZip(bytes: ArrayBuffer): ZipPreflight {
  const view = new DataView(bytes);
  const archiveBytes = new Uint8Array(bytes);
  const minimumEocdBytes = 22;
  const maximumZipCommentBytes = 65_535;
  let eocdOffset = -1;
  for (
    let offset = bytes.byteLength - minimumEocdBytes;
    offset >= Math.max(0, bytes.byteLength - minimumEocdBytes - maximumZipCommentBytes);
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Workbook is not a valid .xlsx ZIP archive.');

  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryBytes = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  if (entryCount === 0xffff || centralDirectoryBytes === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error('ZIP64 workbooks are not supported.');
  }
  if (entriesOnDisk !== entryCount) throw new Error('Workbook EOCD entry counts disagree.');
  if (entryCount > XLSX_INTAKE_LIMITS.maxZipEntries) {
    throw new Error(`Workbook exceeds the ${XLSX_INTAKE_LIMITS.maxZipEntries.toLocaleString('en-US')} ZIP entries limit.`);
  }
  if (centralDirectoryOffset + centralDirectoryBytes > bytes.byteLength) {
    throw new Error('Workbook has an invalid ZIP central directory.');
  }

  let offset = centralDirectoryOffset;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;
  let hasExcessiveEntryRatio = false;
  const entriesByLocalOffset: ZipPreflight['entriesByLocalOffset'] = [];
  let traversedEntries = 0;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectoryBytes;
  while (offset < centralDirectoryEnd) {
    if (offset + 46 > centralDirectoryEnd || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Workbook has an invalid ZIP central-directory entry.');
    }
    const compressedBytes = view.getUint32(offset + 20, true);
    const uncompressedBytes = view.getUint32(offset + 24, true);
    const flags = view.getUint16(offset + 8, true);
    const filenameBytes = view.getUint16(offset + 28, true);
    const extraBytes = view.getUint16(offset + 30, true);
    const commentBytes = view.getUint16(offset + 32, true);
    totalCompressedBytes += compressedBytes;
    totalUncompressedBytes += uncompressedBytes;
    entriesByLocalOffset.push({
      compressedBytes,
      name: strFromU8(archiveBytes.subarray(offset + 46, offset + 46 + filenameBytes), (flags & 0x0800) === 0),
      usesDataDescriptor: (flags & 0x0008) !== 0,
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    if (uncompressedBytes > compressedBytes * XLSX_INTAKE_LIMITS.maxCompressionRatio) {
      hasExcessiveEntryRatio = true;
    }
    offset += 46 + filenameBytes + extraBytes + commentBytes;
    if (offset > centralDirectoryEnd) throw new Error('Workbook has an invalid ZIP central-directory entry length.');
    traversedEntries += 1;
    if (traversedEntries > XLSX_INTAKE_LIMITS.maxZipEntries) {
      throw new Error(`Workbook exceeds the ${XLSX_INTAKE_LIMITS.maxZipEntries.toLocaleString('en-US')} ZIP entries limit.`);
    }
  }
  if (traversedEntries !== entryCount) {
    throw new Error('Workbook entry count does not match its full central directory.');
  }

  if (totalUncompressedBytes > XLSX_INTAKE_LIMITS.maxUncompressedBytes) {
    throw new Error('Workbook exceeds the 50 MB uncompressed ZIP limit.');
  }
  if (hasExcessiveEntryRatio || totalUncompressedBytes > totalCompressedBytes * XLSX_INTAKE_LIMITS.maxCompressionRatio) {
    throw new Error('Workbook exceeds the 100:1 compression ratio limit.');
  }
  entriesByLocalOffset.sort((left, right) => left.localHeaderOffset - right.localHeaderOffset);
  return { entriesByLocalOffset, totalCompressedBytes };
}

function validateActualZipExpansion(bytes: Uint8Array, preflight: ZipPreflight): void {
  let traversedEntries = 0;
  let totalOutputBytes = 0;
  const unzip = new Unzip((file) => {
    const expected = preflight.entriesByLocalOffset[traversedEntries];
    traversedEntries += 1;
    if (traversedEntries > XLSX_INTAKE_LIMITS.maxZipEntries) {
      throw new Error(`Workbook exceeds the ${XLSX_INTAKE_LIMITS.maxZipEntries.toLocaleString('en-US')} ZIP entries limit.`);
    }
    if (!expected || file.name !== expected.name) {
      throw new Error('Workbook local entry does not match its central-directory record.');
    }
    if (!expected.usesDataDescriptor && file.size !== expected.compressedBytes) {
      throw new Error('Workbook local and central compressed sizes disagree.');
    }
    let entryOutputBytes = 0;
    file.ondata = (error, chunk) => {
      if (error) throw error;
      entryOutputBytes += chunk.byteLength;
      totalOutputBytes += chunk.byteLength;
      if (totalOutputBytes > XLSX_INTAKE_LIMITS.maxUncompressedBytes) {
        throw new Error('Workbook actual decompressed data exceeds the 50 MB limit.');
      }
      if (entryOutputBytes > expected.compressedBytes * XLSX_INTAKE_LIMITS.maxCompressionRatio) {
        throw new Error('Workbook actual data exceeds the 100:1 per-entry compression ratio limit.');
      }
      if (totalOutputBytes > preflight.totalCompressedBytes * XLSX_INTAKE_LIMITS.maxCompressionRatio) {
        throw new Error('Workbook actual data exceeds the 100:1 aggregate compression ratio limit.');
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);

  const inputChunkBytes = 8 * 1024;
  for (let offset = 0; offset < bytes.byteLength; offset += inputChunkBytes) {
    const end = Math.min(offset + inputChunkBytes, bytes.byteLength);
    unzip.push(bytes.subarray(offset, end), end === bytes.byteLength);
  }
  if (traversedEntries !== preflight.entriesByLocalOffset.length) {
    throw new Error('Workbook decompression did not traverse every archive entry.');
  }
}

export async function readXlsxIntakeFile(
  file: Pick<File, 'size' | 'arrayBuffer'>,
): Promise<IntakeRow[]> {
  if (file.size > XLSX_INTAKE_LIMITS.maxFileBytes) {
    throw new Error('Workbook exceeds the 10 MB file limit.');
  }
  return parseXlsxIntake(await file.arrayBuffer());
}

export async function parseXlsxIntake(bytes: ArrayBuffer): Promise<IntakeRow[]> {
  if (bytes.byteLength > XLSX_INTAKE_LIMITS.maxFileBytes) {
    throw new Error('Workbook exceeds the 10 MB file limit.');
  }
  const immutableBytes = new Uint8Array(bytes.slice(0));
  const preflight = preflightXlsxZip(immutableBytes.buffer);
  validateActualZipExpansion(immutableBytes, preflight);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(immutableBytes as unknown as Buffer);

  if (workbook.worksheets.length === 0) throw new Error('Workbook contains no worksheets.');
  if (workbook.worksheets.length > XLSX_INTAKE_LIMITS.maxWorksheets) {
    throw new Error(`Workbook exceeds the ${XLSX_INTAKE_LIMITS.maxWorksheets} worksheets limit.`);
  }

  for (const worksheet of workbook.worksheets) {
    if (worksheet.rowCount > XLSX_INTAKE_LIMITS.maxDataRows + 1) {
      throw new Error(`Worksheet "${worksheet.name}" exceeds the ${XLSX_INTAKE_LIMITS.maxDataRows.toLocaleString('en-US')} data rows limit.`);
    }
    if (worksheet.columnCount > XLSX_INTAKE_LIMITS.maxColumns) {
      throw new Error(`Worksheet "${worksheet.name}" exceeds the ${XLSX_INTAKE_LIMITS.maxColumns} columns limit.`);
    }
  }

  const sheet = workbook.worksheets[0];
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column - 1] = String(safeCellValue(cell.value) ?? '').trim();
  });

  const rows: IntakeRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row: IntakeRow = {};
    for (let column = 1; column <= headers.length; column += 1) {
      const header = headers[column - 1];
      if (header) row[header] = safeCellValue(sheet.getCell(rowNumber, column).value) ?? '';
    }
    rows.push(row);
  }
  return rows;
}
