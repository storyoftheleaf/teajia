// Shapes used while turning a dropped PDF into a Tea Atlas source.
// The pipeline (docs/TEA_ATLAS.md, "Adding a source in the admin"):
//
//   pdf.js  →  PdfDoc (lines + picture refs per page)        extract.ts
//           →  proposed sections (outline, contents, headings) split.ts
//           →  the person checks and fixes them               AtlasAddSourcePage
//           →  format-1 package for one source                buildPackage.ts
//           →  bucket, and merged into the index              mergeIndex.ts, publish.ts
//
// Everything but extract.ts and publish.ts is pure, so it runs in the tests
// and in Node against real PDFs as well as in the browser.

/** One printed line, in reading order. `y` is the baseline, measured from the top. */
export interface PdfLine {
  text: string;
  size: number;
  x: number;
  right: number;
  y: number;
}

/** A picture on a page, before it is decided whether to keep it. */
export interface PdfPictureRef {
  /** pdf.js object name; the same name on several pages is the same picture. */
  name: string;
  width: number;
  height: number;
}

export interface PdfPage {
  /** 0-based PDF page. */
  index: number;
  width: number;
  height: number;
  lines: PdfLine[];
  pictures: PdfPictureRef[];
}

export interface PdfOutlineEntry {
  title: string;
  /** 0-based PDF page the bookmark points at. */
  page: number;
  /** Bookmarks under this one (a part's chapters). */
  children?: PdfOutlineEntry[];
}

export interface PdfDoc {
  /** From the PDF's own properties; often empty. */
  title: string;
  author: string;
  pageCount: number;
  /** The PDF's own page labels ("i", "ii", "1"...), when it has them. */
  labels: string[] | null;
  /** Bookmarks, from below a lone "book title" bookmark if there is one. */
  outline: PdfOutlineEntry[];
  pages: PdfPage[];
}

export type SplitMethod = 'outline' | 'contents' | 'headings' | 'whole';

/** A proposed article: where it starts and what it is called. It ends where the next one starts. */
export interface ProposedSection {
  title: string;
  /** When the contents page names one ("By Wang Duozhi"). */
  author?: string;
  /** 0-based PDF page. */
  start: number;
}

export interface SplitProposal {
  method: SplitMethod;
  sections: ProposedSection[];
}
