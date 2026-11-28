import { describe, expect, it } from 'vitest';
import { appSourceFiles } from './sourceFiles.testkit';

// GUARD: the site has one photo editor (CLAUDE.md, "Every photo added goes
// through the one photo editor"; the catalog is docs/COMPONENTS.md).
//
// 1. Only the shared editor draws the cropper. A second cropper means a second
//    look and a second set of bugs, and Adrian's tuning stops reaching it.
// 2. A file picker that takes pictures either sends them through the editor
//    (`usePhotoEditor`, `SquareCropModal`, or an `editPhoto` handed down from
//    the parent) or is one of the places below that must keep every pixel or
//    already keep the original with a frame. Adding a place here needs the
//    reason beside it, so a reviewer sees the choice.

const CROPPER_HOME = 'src/components/shared/SquareCropModal.tsx';

const KEEPS_THE_WHOLE_PHOTO: Record<string, string> = {
  'src/components/curate/CurateRecordTools.tsx': 'private attachments (receipts, business cards, PDFs)',
  'src/components/CurateV2/RecordTools.tsx': 'private attachments (receipts, business cards, PDFs)',
  'src/components/CurateV2/import/ImportInput.tsx': 'import: the analysis reads the whole photo',
  'src/components/CurateV2/import/ImportEvidencePreview.tsx': 'import evidence',
  'src/components/CurateV2/LedgerView.tsx': 'a receipt on a ledger line',
  'src/components/TeaCompass/import/ImportInput.tsx': 'import: the analysis reads the whole photo',
  'src/components/TeaCompass/import/ImportEvidencePreview.tsx': 'import evidence',
  'src/components/TeaCompass/LedgerView.tsx': 'a receipt on a ledger line',
  'src/components/vendors/VendorFaceGallery.tsx': 'faces are reframed in the Faces grid with the shared editor',
  'src/components/shop/ProductDetailLayout.tsx': 'family photos keep the original and are framed with PhotographCrop',
  'src/components/tasting/TastingPhotographRow.tsx': 'tasting photos keep the original and are framed with PhotographCrop',
  'src/admin/components/contributorEditor/GalleryPlace.tsx': 'contributor pages keep the original with a frame',
  'src/admin/components/EventForm/sections/BasicInfoSection.tsx': 'EditForm passes the picked file through editPhoto',
  'src/admin/views/IntakeWorkspace.tsx': 'intake: the analysis reads the whole photo',
  'src/admin/views/StockGalleryProposal.tsx': 'the reading is made from the whole photo',
};

const FILE_INPUT = /<input\b[^>]*type="file"[^>]*>/gs;
const takesPictures = (input: string) => !/accept=/.test(input) || /accept=\{/.test(input) || /accept="[^"]*image/.test(input);
const usesEditor = (text: string) => /usePhotoEditor|SquareCropModal|editPhoto/.test(text);

describe('one photo editor', () => {
  const files = appSourceFiles();

  it('only the shared editor draws a cropper', () => {
    const croppers = files
      .filter(f => /from ['"]react-easy-crop['"]|from ['"]react-image-crop['"]/.test(f.text))
      .map(f => f.rel);
    expect(croppers).toEqual([CROPPER_HOME]);
  });

  it('every picture picker opens the shared editor or says why it keeps the whole photo', () => {
    const bare = files
      .filter(f => f.rel.endsWith('.tsx'))
      .filter(f => [...f.text.matchAll(FILE_INPUT)].some(m => takesPictures(m[0])))
      .filter(f => !usesEditor(f.text) && !KEEPS_THE_WHOLE_PHOTO[f.rel])
      .map(f => f.rel);
    expect(bare, 'Send the photo through usePhotoEditor() (src/components/shared/usePhotoEditor.tsx)').toEqual([]);
  });

  it('the list of places that keep the whole photo only names real pickers', () => {
    const byPath = new Map(files.map(f => [f.rel, f.text]));
    const stale = Object.keys(KEEPS_THE_WHOLE_PHOTO).filter(rel => {
      const text = byPath.get(rel);
      return !text || usesEditor(text) || ![...text.matchAll(FILE_INPUT)].some(m => takesPictures(m[0]));
    });
    expect(stale).toEqual([]);
  });
});
