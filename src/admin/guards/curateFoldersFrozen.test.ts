import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isTestSupportFile, REPO_ROOT } from './sourceFiles.testkit';

// GUARD: the two Curate folders are frozen to fixes.
//
// src/components/TeaCompass/ (live at /admin/compass) and
// src/components/CurateV2/ (at /admin/compass/v2) are being replaced by one new
// Curate built in a neutral folder, src/components/curate/ (see
// todo/plans/manage-rebuild.md, root cause 2). So neither folder may gain a
// file. Fixes to the files already there are fine.
//
// Each list below is every non-test file in the folder, subfolders included,
// on 2026-11-11. A file that is not on its list fails the test. Deleting or
// renaming a file also fails until the list is updated, which is the one way
// a list is allowed to change, and it should only ever get shorter.

const CURATE_V2_FILES = [
    'src/components/CurateV2/ActiveFilterSummary.tsx',
    'src/components/CurateV2/AgentInbox.tsx',
    'src/components/CurateV2/AutocompleteInput.tsx',
    'src/components/CurateV2/BatchCaptureRow.tsx',
    'src/components/CurateV2/BrowseCard.tsx',
    'src/components/CurateV2/BrowseView.tsx',
    'src/components/CurateV2/CaptureActionFooter.tsx',
    'src/components/CurateV2/CaptureCard.tsx',
    'src/components/CurateV2/CaptureContextChips.tsx',
    'src/components/CurateV2/CardParts.tsx',
    'src/components/CurateV2/CompareView.tsx',
    'src/components/CurateV2/CompassEntryDetailPanel.tsx',
    'src/components/CurateV2/CompassIcon.tsx',
    'src/components/CurateV2/CompassShareModal.tsx',
    'src/components/CurateV2/CreateInventoryRecordAction.tsx',
    'src/components/CurateV2/CuratePrimitives.tsx',
    'src/components/CurateV2/CurateSheet.tsx',
    'src/components/CurateV2/DecisionControl.tsx',
    'src/components/CurateV2/DetailsRow.tsx',
    'src/components/CurateV2/DriveLine.tsx',
    'src/components/CurateV2/DuplicateNudge.tsx',
    'src/components/CurateV2/EncounterContext.tsx',
    'src/components/CurateV2/FastTastingSheet.tsx',
    'src/components/CurateV2/FormRow.tsx',
    'src/components/CurateV2/GramSlider.tsx',
    'src/components/CurateV2/ImportBatchChip.tsx',
    'src/components/CurateV2/InputParser.ts',
    'src/components/CurateV2/IntentBar.tsx',
    'src/components/CurateV2/JourneyVisitSheet.tsx',
    'src/components/CurateV2/LedgerOverviewPanel.tsx',
    'src/components/CurateV2/LedgerPdf.tsx',
    'src/components/CurateV2/LedgerView.tsx',
    'src/components/CurateV2/LibraryFilterSheet.tsx',
    'src/components/CurateV2/LibraryImportsSection.tsx',
    'src/components/CurateV2/NotesField.tsx',
    'src/components/CurateV2/OrderBar.tsx',
    'src/components/CurateV2/OrderMessageSheet.tsx',
    'src/components/CurateV2/OrderSummary.tsx',
    'src/components/CurateV2/PhotoCapture.tsx',
    'src/components/CurateV2/PricingRow.tsx',
    'src/components/CurateV2/RecordTools.tsx',
    'src/components/CurateV2/SaidSheet.tsx',
    'src/components/CurateV2/SampleOrderAction.tsx',
    'src/components/CurateV2/SampleUseLine.tsx',
    'src/components/CurateV2/SessionReview.tsx',
    'src/components/CurateV2/SessionStack.tsx',
    'src/components/CurateV2/StatusActions.tsx',
    'src/components/CurateV2/StructuredTeaFields.tsx',
    'src/components/CurateV2/SyncIndicator.tsx',
    'src/components/CurateV2/SyncNotice.tsx',
    'src/components/CurateV2/TableList.tsx',
    'src/components/CurateV2/TasteRows.tsx',
    'src/components/CurateV2/TeaFace.tsx',
    'src/components/CurateV2/TeaTagSheet.tsx',
    'src/components/CurateV2/TeawarePhotos.tsx',
    'src/components/CurateV2/TodayView.tsx',
    'src/components/CurateV2/TypeGrid.tsx',
    'src/components/CurateV2/VendorCard.tsx',
    'src/components/CurateV2/VendorHistory.tsx',
    'src/components/CurateV2/VendorInfoPanel.tsx',
    'src/components/CurateV2/VendorPicker.tsx',
    'src/components/CurateV2/VendorStrip.tsx',
    'src/components/CurateV2/VendorsView.tsx',
    'src/components/CurateV2/VoiceRecorder.tsx',
    'src/components/CurateV2/curatePricing.ts',
    'src/components/CurateV2/curateV2Model.ts',
    'src/components/CurateV2/import/ImportBatchReview.tsx',
    'src/components/CurateV2/import/ImportBatchSummary.tsx',
    'src/components/CurateV2/import/ImportCompletionSummary.tsx',
    'src/components/CurateV2/import/ImportDeleteAction.tsx',
    'src/components/CurateV2/import/ImportEvidenceCard.tsx',
    'src/components/CurateV2/import/ImportEvidencePreview.tsx',
    'src/components/CurateV2/import/ImportFolioHeader.tsx',
    'src/components/CurateV2/import/ImportInput.tsx',
    'src/components/CurateV2/import/ImportItemRow.tsx',
    'src/components/CurateV2/import/ImportJourneyPicker.tsx',
    'src/components/CurateV2/import/ImportMatchPicker.tsx',
    'src/components/CurateV2/import/ImportPanel.tsx',
    'src/components/CurateV2/import/ImportVendorGroup.tsx',
    'src/components/CurateV2/import/importDraftStorage.ts',
    'src/components/CurateV2/import/importErrorMessage.ts',
    'src/components/CurateV2/import/importEvidence.ts',
    'src/components/CurateV2/import/importEvidenceSelection.ts',
    'src/components/CurateV2/import/importFolioPresentation.ts',
    'src/components/CurateV2/import/importIdentityEnrichment.ts',
    'src/components/CurateV2/import/importReviewDomain.ts',
    'src/components/CurateV2/import/importTypes.ts',
    'src/components/CurateV2/index.tsx',
    'src/components/CurateV2/libraryPossession.ts',
    'src/components/CurateV2/orderArrivals.ts',
    'src/components/CurateV2/orderBuy.ts',
    'src/components/CurateV2/orderMessage.ts',
    'src/components/CurateV2/placeOrder.ts',
    'src/components/CurateV2/plainFailure.ts',
    'src/components/CurateV2/saidFiling.ts',
    'src/components/CurateV2/sampleUse.ts',
    'src/components/CurateV2/shopOrders.ts',
    'src/components/CurateV2/types.ts',
    'src/components/CurateV2/useCommitAndPromote.ts',
];

const TEA_COMPASS_FILES = [
    'src/components/TeaCompass/ActiveFilterSummary.tsx',
    'src/components/TeaCompass/ArTeaSources.tsx',
    'src/components/TeaCompass/ArTranscriptHandoff.tsx',
    'src/components/TeaCompass/AutocompleteInput.tsx',
    'src/components/TeaCompass/BatchCaptureRow.tsx',
    'src/components/TeaCompass/BrowseCard.tsx',
    'src/components/TeaCompass/BrowseView.tsx',
    'src/components/TeaCompass/CaptureActionFooter.tsx',
    'src/components/TeaCompass/CaptureCard.tsx',
    'src/components/TeaCompass/CaptureContextChips.tsx',
    'src/components/TeaCompass/CompassEntryDetailPanel.tsx',
    'src/components/TeaCompass/CompassIcon.tsx',
    'src/components/TeaCompass/CompassShareModal.tsx',
    'src/components/TeaCompass/CreateInventoryRecordAction.tsx',
    'src/components/TeaCompass/CuratePrimitives.tsx',
    'src/components/TeaCompass/DecisionControl.tsx',
    'src/components/TeaCompass/DetailsRow.tsx',
    'src/components/TeaCompass/DraftVoiceMaterial.tsx',
    'src/components/TeaCompass/DuplicateNudge.tsx',
    'src/components/TeaCompass/EncounterContext.tsx',
    'src/components/TeaCompass/FormRow.tsx',
    'src/components/TeaCompass/GramSlider.tsx',
    'src/components/TeaCompass/ImportBatchChip.tsx',
    'src/components/TeaCompass/InputParser.ts',
    'src/components/TeaCompass/IntentBar.tsx',
    'src/components/TeaCompass/JourneyVisitSheet.tsx',
    'src/components/TeaCompass/LedgerOverviewPanel.tsx',
    'src/components/TeaCompass/LedgerPdf.tsx',
    'src/components/TeaCompass/LedgerView.tsx',
    'src/components/TeaCompass/LegacyLocalRecovery.tsx',
    'src/components/TeaCompass/LibraryCurrencyPicker.tsx',
    'src/components/TeaCompass/LibraryFilterSheet.tsx',
    'src/components/TeaCompass/LibraryGivenName.tsx',
    'src/components/TeaCompass/LibraryImportsSection.tsx',
    'src/components/TeaCompass/LibraryInlineValue.tsx',
    'src/components/TeaCompass/LibraryQuoteWeight.tsx',
    'src/components/TeaCompass/LibraryReceiptActions.tsx',
    'src/components/TeaCompass/LibrarySupplierActions.tsx',
    'src/components/TeaCompass/NotesField.tsx',
    'src/components/TeaCompass/OrderBar.tsx',
    'src/components/TeaCompass/OrderSummary.tsx',
    'src/components/TeaCompass/PhotoCapture.tsx',
    'src/components/TeaCompass/PricingRow.tsx',
    'src/components/TeaCompass/SampleOrderAction.tsx',
    'src/components/TeaCompass/SessionReview.tsx',
    'src/components/TeaCompass/SessionStack.tsx',
    'src/components/TeaCompass/StatusActions.tsx',
    'src/components/TeaCompass/StructuredTeaFields.tsx',
    'src/components/TeaCompass/SyncIndicator.tsx',
    'src/components/TeaCompass/TeaDescriptionReview.tsx',
    'src/components/TeaCompass/TeaRecordAssistant.tsx',
    'src/components/TeaCompass/TeaRecordFields.tsx',
    'src/components/TeaCompass/TeaReviewDialog.tsx',
    'src/components/TeaCompass/TeaTagSheet.tsx',
    'src/components/TeaCompass/TeawarePhotos.tsx',
    'src/components/TeaCompass/TypeGrid.tsx',
    'src/components/TeaCompass/VendorHistory.tsx',
    'src/components/TeaCompass/VendorInfoPanel.tsx',
    'src/components/TeaCompass/VendorStrip.tsx',
    'src/components/TeaCompass/VoiceRecorder.tsx',
    'src/components/TeaCompass/WorkingMaterialReview.tsx',
    'src/components/TeaCompass/acquisitionPricing.ts',
    'src/components/TeaCompass/curatePricing.ts',
    'src/components/TeaCompass/import/ImportBatchReview.tsx',
    'src/components/TeaCompass/import/ImportBatchSummary.tsx',
    'src/components/TeaCompass/import/ImportCompletionSummary.tsx',
    'src/components/TeaCompass/import/ImportDeleteAction.tsx',
    'src/components/TeaCompass/import/ImportEvidenceCard.tsx',
    'src/components/TeaCompass/import/ImportEvidencePreview.tsx',
    'src/components/TeaCompass/import/ImportFolioHeader.tsx',
    'src/components/TeaCompass/import/ImportInput.tsx',
    'src/components/TeaCompass/import/ImportItemRow.tsx',
    'src/components/TeaCompass/import/ImportJourneyPicker.tsx',
    'src/components/TeaCompass/import/ImportMatchPicker.tsx',
    'src/components/TeaCompass/import/ImportPanel.tsx',
    'src/components/TeaCompass/import/ImportVendorGroup.tsx',
    'src/components/TeaCompass/import/importDraftStorage.ts',
    'src/components/TeaCompass/import/importErrorMessage.ts',
    'src/components/TeaCompass/import/importEvidence.ts',
    'src/components/TeaCompass/import/importEvidenceSelection.ts',
    'src/components/TeaCompass/import/importFolioPresentation.ts',
    'src/components/TeaCompass/import/importIdentityEnrichment.ts',
    'src/components/TeaCompass/import/importReviewDomain.ts',
    'src/components/TeaCompass/import/importTypes.ts',
    'src/components/TeaCompass/index.tsx',
    'src/components/TeaCompass/libraryCardWorkflow.ts',
    'src/components/TeaCompass/libraryPossession.ts',
    'src/components/TeaCompass/libraryPriceDisplay.ts',
    'src/components/TeaCompass/librarySupplierGroups.ts',
    'src/components/TeaCompass/teaRecordEvidence.ts',
    'src/components/TeaCompass/types.ts',
    'src/components/TeaCompass/useCommitAndPromote.ts',
    'src/components/TeaCompass/useLiveTeaTranscripts.ts',
];

function filesIn(folder: string): string[] {
  // Every file of any kind (a stylesheet or a JSON file counts), not only .ts/.tsx.
  const root = join(REPO_ROOT, folder);
  return (readdirSync(root, { recursive: true }) as string[])
    .map(name => `${folder}${name.split('\\').join('/')}`)
    .filter(rel => statSync(join(REPO_ROOT, rel)).isFile() && !isTestSupportFile(rel))
    .sort();
}

function guardFolder(folder: string, snapshot: string[]) {
  describe(`${folder} takes no new files`, () => {
    const now = filesIn(folder);

    it('has no file that is not in the snapshot', () => {
      const added = now.filter(rel => !snapshot.includes(rel));
      expect(
        added,
        `New files in ${folder}. This folder is frozen to fixes while Curate is rebuilt: put new Curate work in src/components/curate/ instead. `
        + 'Do not add the file to the snapshot.',
      ).toEqual([]);
    });

    it('has no snapshot entry whose file is gone', () => {
      const gone = snapshot.filter(rel => !now.includes(rel));
      expect(
        gone,
        `These files were deleted or renamed. Remove them from the snapshot in this test (the list may only shrink). A renamed file is a new file: move it to src/components/curate/ instead.`,
      ).toEqual([]);
    });
  });
}

guardFolder('src/components/CurateV2/', CURATE_V2_FILES);
guardFolder('src/components/TeaCompass/', TEA_COMPASS_FILES);
