import ExcelJS from 'exceljs';
import { DocumentBlock, DocumentModel, DocumentPage } from '../types';

// Standard A4 in points, used whenever a page doesn't carry its own real PDF dimensions
// (e.g. the hand-authored sample document).
const FALLBACK_PAGE_WIDTH_PT = 595.28;
const FALLBACK_PAGE_HEIGHT_PT = 841.89;

// The grid resolution each page is divided into. Every block is placed by merging the cells
// that its own (x, y, width, height) percentages cover, so this is really just how fine the
// placement can be — not a literal "table" in the source document. Rows get a finer division
// than columns since these are portrait pages (taller than wide), so a 1% step in each
// direction covers roughly the same physical distance.
const GRID_COLS = 100;
const GRID_ROWS = 140;

const BORDER_COLOR = { argb: 'FFCBD5E1' }; // light slate — close to typical form/table gridlines
const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: BORDER_COLOR };

function hexToArgb(hex?: string, fallback = 'FF0F172A'): string {
  if (!hex) return fallback;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) return `FF${clean.toUpperCase()}`;
  if (clean.length === 8) return clean.toUpperCase();
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Converts a block's page-relative percentage rectangle into 1-indexed grid cell bounds. */
function blockToGridRect(block: DocumentBlock) {
  const x = block.x ?? 5;
  const y = block.y ?? 5;
  const width = Math.max(block.width ?? 20, 2);
  const height = Math.max(block.height ?? 2.5, 1);

  const startCol = clamp(Math.round((x / 100) * GRID_COLS), 0, GRID_COLS - 1) + 1;
  const endCol = clamp(Math.round(((x + width) / 100) * GRID_COLS), startCol, GRID_COLS);
  const startRow = clamp(Math.round((y / 100) * GRID_ROWS), 0, GRID_ROWS - 1) + 1;
  const endRow = clamp(Math.round(((y + height) / 100) * GRID_ROWS), startRow, GRID_ROWS);

  return { startRow, endRow, startCol, endCol };
}

/**
 * Tracks which grid cells a previous block has already claimed (via a merge or a plain cell
 * value), since two blocks whose measured positions round to the same grid cell would
 * otherwise make ExcelJS throw ("Cannot merge already merged cells") and abort the whole
 * export over a single field.
 */
class OccupancyTracker {
  private claimed = new Set<string>();

  private key(r: number, c: number): string {
    return `${r},${c}`;
  }

  isFree(r: number, c: number): boolean {
    return !this.claimed.has(this.key(r, c));
  }

  claim(startRow: number, endRow: number, startCol: number, endCol: number) {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.claimed.add(this.key(r, c));
      }
    }
  }

  /**
   * Shrinks a candidate rectangle so it no longer overlaps anything already claimed, by
   * pulling endCol/endRow inward. Returns null if even the top-left starting cell is taken
   * (rare — two blocks rounding to the exact same starting cell), in which case the caller
   * should skip placing this block rather than fight over the cell.
   */
  fitRect(startRow: number, endRow: number, startCol: number, endCol: number) {
    if (!this.isFree(startRow, startCol)) return null;

    let safeEndCol = endCol;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol + 1; c <= safeEndCol; c++) {
        if (!this.isFree(r, c)) {
          safeEndCol = c - 1;
          break;
        }
      }
    }

    let safeEndRow = endRow;
    for (let r = startRow + 1; r <= safeEndRow; r++) {
      let rowClear = true;
      for (let c = startCol; c <= safeEndCol; c++) {
        if (!this.isFree(r, c)) {
          rowClear = false;
          break;
        }
      }
      if (!rowClear) {
        safeEndRow = r - 1;
        break;
      }
    }

    return { startRow, endRow: safeEndRow, startCol, endCol: safeEndCol };
  }
}

function applyBlockToWorksheet(worksheet: ExcelJS.Worksheet, block: DocumentBlock, occupancy: OccupancyTracker) {
  if (block.type === 'divider') return; // decorative rule — nothing meaningful to place
  if (!block.content && !block.tableData) return;

  const rawRect = blockToGridRect(block);

  // An embedded table block (used by hand-authored documents, not PDF import) — lay its own
  // rows/columns out starting at the block's position rather than treating it as one cell.
  if (block.type === 'table' && block.tableData) {
    const { startRow, endCol, startCol } = rawRect;
    const allRows = [block.tableData.headers, ...block.tableData.rows];
    const totalCols = Math.max(block.tableData.headers.length, 1);
    const colSpan = Math.max(1, Math.floor((endCol - startCol + 1) / totalCols));
    allRows.forEach((row, rIdx) => {
      const rowIndex = startRow + rIdx;
      row.forEach((cellText, cIdx) => {
        const cellStartCol = startCol + cIdx * colSpan;
        const cellEndCol = cIdx === row.length - 1 ? endCol : cellStartCol + colSpan - 1;
        const fitted = occupancy.fitRect(rowIndex, rowIndex, cellStartCol, cellEndCol);
        if (!fitted) return; // cell already taken — skip rather than crash the export
        const cell = worksheet.getCell(fitted.startRow, fitted.startCol);
        cell.value = cellText;
        cell.font = { name: 'Calibri', size: 10, bold: rIdx === 0 };
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        try {
          if (fitted.endCol > fitted.startCol) {
            worksheet.mergeCells(fitted.startRow, fitted.startCol, fitted.endRow, fitted.endCol);
          }
          for (let c = fitted.startCol; c <= fitted.endCol; c++) {
            worksheet.getCell(fitted.startRow, c).border = {
              top: THIN_BORDER,
              bottom: THIN_BORDER,
              left: THIN_BORDER,
              right: THIN_BORDER,
            };
          }
        } catch (err) {
          console.warn('xlsx export: skipped merging a table cell', err);
        }
        occupancy.claim(fitted.startRow, fitted.endRow, fitted.startCol, fitted.endCol);
      });
    });
    return;
  }

  const fitted = occupancy.fitRect(rawRect.startRow, rawRect.endRow, rawRect.startCol, rawRect.endCol);
  if (!fitted) return; // starting cell already taken by an earlier block — skip rather than crash
  const { startRow, endRow, startCol, endCol } = fitted;

  const targetCell = worksheet.getCell(startRow, startCol);
  targetCell.value = block.content;
  targetCell.font = {
    name: 'Calibri',
    size: clamp(Math.round(block.fontSize ?? 11), 7, 36),
    bold: !!block.isBold || block.type === 'h1' || block.type === 'h2' || block.type === 'h3',
    italic: !!block.isItalic,
    color: { argb: hexToArgb(block.textColor) },
  };
  targetCell.alignment = {
    horizontal: block.align === 'justify' ? 'left' : block.align || 'left',
    vertical: 'top',
    wrapText: true,
  };

  try {
    if (endRow > startRow || endCol > startCol) {
      worksheet.mergeCells(startRow, startCol, endRow, endCol);
    }

    // A page title (h1) usually floats above the table rather than living inside a bordered
    // cell in the source document, so leave it border-free; everything else in a parsed PDF —
    // in every document tested — was inside a bordered field or table cell.
    if (block.type !== 'h1') {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          worksheet.getCell(r, c).border = {
            top: THIN_BORDER,
            bottom: THIN_BORDER,
            left: THIN_BORDER,
            right: THIN_BORDER,
          };
        }
      }
    }
  } catch (err) {
    // Should be unreachable now that fitRect() only returns non-overlapping rectangles, but
    // one bad cell must never take down the whole export.
    console.warn('xlsx export: skipped merging a block', block.id, err);
  }

  occupancy.claim(startRow, endRow, startCol, endCol);
}

function buildWorksheetForPage(workbook: ExcelJS.Workbook, page: DocumentPage, pageIndex: number) {
  const worksheet = workbook.addWorksheet(`Page ${pageIndex + 1}`, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const pageWidthPt = page.width || FALLBACK_PAGE_WIDTH_PT;
  const pageHeightPt = page.height || FALLBACK_PAGE_HEIGHT_PT;

  // Column width is in Excel's "character width" units. The standard conversion is
  // px = round(units * MDW + 5), where MDW (max digit width, ~7px for Calibri 11) and the
  // constant "+5" is a one-time per-visible-column padding overhead. That "+5" must NOT be
  // divided across our 100 fine grid slices — subtracting it from each slice individually
  // (as an earlier version of this did) ate away most of the real width, forcing far more
  // text-wrapping than the original document had. Since Excel doesn't grow row height to fit
  // wrapped text in a merged cell, that wrapping just got silently clipped. Each slice's width
  // is simply its share of pixels converted through MDW, with no per-slice offset.
  const pxPerCol = ((pageWidthPt * 1.3333) / GRID_COLS);
  const colWidthUnits = Math.max(0.3, pxPerCol / 7);
  for (let c = 1; c <= GRID_COLS; c++) {
    worksheet.getColumn(c).width = colWidthUnits;
  }

  // Row height is in points directly in Excel — a direct, precise mapping from the PDF's own
  // point-based page height. A small (12%) safety margin is added since Excel does not
  // auto-grow row height to fit wrapped text inside a merged cell (unlike a normal cell), so
  // a little slack here is cheap insurance against a line of text clipping.
  const rowHeightPt = (pageHeightPt / GRID_ROWS) * 1.12;
  for (let r = 1; r <= GRID_ROWS; r++) {
    worksheet.getRow(r).height = rowHeightPt;
  }

  const occupancy = new OccupancyTracker();
  for (const block of page.blocks) {
    applyBlockToWorksheet(worksheet, block, occupancy);
  }
}

/**
 * Exports the document to a styled .xlsx workbook — one worksheet per page — that reproduces
 * the original PDF's layout: every field keeps its real position, font weight/size, alignment,
 * and a border matching the source's bordered fields/table cells, by placing each block into
 * merged cells on a fine shared grid rather than dumping text into sequential rows.
 */
export async function exportToXlsx(docModel: DocumentModel): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PDF Converter';
  workbook.title = docModel.title || 'Document';
  workbook.created = new Date();

  docModel.pages.forEach((page, idx) => buildWorksheetForPage(workbook, page, idx));

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
