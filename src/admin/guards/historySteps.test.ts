/**
 * Back and forward, held for new code (Adrian, 2026-11-25: "every new thing
 * that builds functions properly with backwards and forwards").
 *
 * The rule is CLAUDE.md, "Back and forward". In short: a tab, screen, open
 * record or panel is a step, kept in the address with `useStepParam` (or a
 * route), so the browser records it. Typing, filters and sort refine in place
 * and may replace the entry, marked `// history: refine`.
 *
 * These checks read the admin source. Each snapshot is what was already there
 * on 2026-11-25; a file may shrink below its number, never grow past it.
 * Shrinking? Lower the number here in the same commit.
 */
import { describe, expect, it } from "vitest";
import { allSourceFiles, isTestSupportFile } from "./sourceFiles.testkit";

const admin = () => allSourceFiles().filter(f => f.rel.startsWith("src/admin/") && !isTestSupportFile(f.rel));

/** A tab, mode, view or screen held only in component state never reaches history. */
const LOCAL_SCREEN_STATE = /const \[(?:active)?(?:tab|mode|view|screen)[A-Za-z]*, *set[A-Za-z]*\] *= *useState/i;
/** Marks a state that is not a step at all: a form mode, a confirm step inside one card. */
const NOT_A_STEP = /history: (not a step|in-page)/;
const STATE_SNAPSHOT: Record<string, number> = {
  "src/admin/components/CustomerNotesReview.tsx": 1,
  "src/admin/components/CustomersView.tsx": 1,
  "src/admin/components/OrdersView.tsx": 1,
  "src/admin/components/SoldItemsView.tsx": 1,
  "src/admin/components/SourcesView.tsx": 1,
  "src/admin/components/TeawareCatalog.tsx": 1,
  "src/admin/components/collections/CollectionShareSheet.tsx": 1,
  "src/admin/components/inventory/IncomingReceiptsPanel.tsx": 1,
  "src/admin/components/inventory/LogisticsControls.tsx": 1,
  "src/admin/components/inventory/stock/FreightSheet.tsx": 1,
  "src/admin/components/sales/SalesPermissionsPanel.tsx": 1,
  "src/admin/views/CollectionEditView.tsx": 1,
  "src/admin/views/PlatformAccessView.tsx": 1,
  "src/admin/views/TeaStockMatch.tsx": 1,
  "src/admin/views/WholesaleOrderTimeline.tsx": 1,
  "src/admin/views/yixing/AddShapeReference.tsx": 1,
};

const REPLACE = /replace: true/;
const REFINE = /history: refine/;
const REPLACE_SNAPSHOT: Record<string, number> = {
  "src/admin/AdminApp.tsx": 4,
  "src/admin/components/EventsManager.tsx": 1,
  "src/admin/components/InventoryView.tsx": 9,
  "src/admin/components/OrdersView.tsx": 1,
  "src/admin/components/inventory/PurchaseTrackingView.tsx": 2,
  "src/admin/components/inventory/stock/StockCardSections.tsx": 1,
  "src/admin/views/IntakeWorkspace.tsx": 2,
  "src/admin/views/MagazineView.tsx": 1,
  "src/admin/views/OAuthConsentView.tsx": 1,
  "src/admin/views/WisdomView.tsx": 1,
  "src/admin/views/yixing/ShapeLibrary.tsx": 2,
};

/** Only these may call navigate(-1) themselves; everything else uses useAdminBack. */
const RAW_BACK_ALLOWED = new Set([
  "src/admin/hooks/useAdminBack.ts",
  "src/admin/components/AdminHistoryBar.tsx",
  "src/admin/components/inventory/usePanelInAddress.ts", // closing a record it opened steps back off that entry
]);

describe("back and forward in the admin", () => {
  it("keeps tabs, screens and views out of local state (use useStepParam)", () => {
    const grown = admin().map(f => ({ rel: f.rel, n: f.text.split("\n").filter(l => LOCAL_SCREEN_STATE.test(l) && !NOT_A_STEP.test(l)).length }))
      .filter(f => f.n > (STATE_SNAPSHOT[f.rel] ?? 0)).map(f => `${f.rel}: ${f.n} (was ${STATE_SNAPSHOT[f.rel] ?? 0})`);
    expect(grown, "A tab, mode or view in useState is invisible to the browser back button. Use useStepParam (src/hooks/useStepParam.ts). If it truly is not a place (a form mode, a confirm step), end the line with // history: not a step").toEqual([]);
  });

  it("does not replace history for a step (only refinements may)", () => {
    const grown = admin().map(f => {
      const lines = f.text.split("\n");
      return { rel: f.rel, n: lines.filter((l, i) => REPLACE.test(l) && !REFINE.test(l) && !REFINE.test(lines[i - 1] || "")).length };
    }).filter(f => f.n > (REPLACE_SNAPSHOT[f.rel] ?? 0)).map(f => `${f.rel}: ${f.n} (was ${REPLACE_SNAPSHOT[f.rel] ?? 0})`);
    expect(grown, "replace: true erases the entry the browser would go back to. A tab, screen or open panel must push. If this is typing, a filter, a sort or a redirect, mark it // history: refine").toEqual([]);
  });

  it("goes back through useAdminBack, which never strands a direct visit", () => {
    const raw = admin().filter(f => !RAW_BACK_ALLOWED.has(f.rel) && /navigate\(-1\)/.test(f.text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))).map(f => f.rel);
    expect(raw, "navigate(-1) does nothing (or leaves the site) on the first page of a visit. Use useAdminBack(fallback) from src/admin/hooks/useAdminBack.ts").toEqual([]);
  });
});
