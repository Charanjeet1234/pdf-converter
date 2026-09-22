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

function applyBlockToWorksheet(worksheet: ExcelJS.Worksheet, block: DocumentBlock) {
  if (block.type === 'divider') return; // decorative rule — nothing meaningful to place
  if (!block.content && !block.tableData) return;

  const { startRow, endRow, startCol, endCol } = blockToGridRect(block);

  // An embedded table block (used by hand-authored documents, not PDF import) — lay its own
  // rows/columns out starting at the block's position rather than treating it as one cell.
  if (block.type === 'table' && block.tableData) {
    const allRows = [block.tableData.headers, ...block.tableData.rows];
    const totalCols = Math.max(block.tableData.headers.length, 1);
    const colSpan = Math.max(1, Math.floor((endCol - startCol + 1) / totalCols));
    allRows.forEach((row, rIdx) => {
      const rowIndex = startRow + rIdx;
      row.forEach((cellText, cIdx) => {
        const cellStartCol = startCol + cIdx * colSpan;
        const cellEndCol = cIdx === row.length - 1 ? endCol : cellStartCol + colSpan - 1;
        const cell = worksheet.getCell(rowIndex, cellStartCol);
        cell.value = cellText;
        cell.font = { name: 'Calibri', size: 10, bold: rIdx === 0 };
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        if (cellEndCol > cellStartCol) {
          worksheet.mergeCells(rowIndex, cellStartCol, rowIndex, cellEndCol);
        }
        for (let c = cellStartCol; c <= cellEndCol; c++) {
          worksheet.getCell(rowIndex, c).border = {
            top: THIN_BORDER,
            bottom: THIN_BORDER,
            left: THIN_BORDER,
            right: THIN_BORDER,
          };
        }
      });
    });
    return;
  }

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
}

function buildWorksheetForPage(workbook: ExcelJS.Workbook, page: DocumentPage, pageIndex: number) {
  const worksheet = workbook.addWorksheet(`Page ${pageIndex + 1}`, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const pageWidthPt = page.width || FALLBACK_PAGE_WIDTH_PT;
  const pageHeightPt = page.height || FALLBACK_PAGE_HEIGHT_PT;

  // Column width is in Excel's "character width" units, roughly px / 7 for the default font.
  const pxPerCol = ((pageWidthPt * 1.3333) / GRID_COLS);
  const colWidthUnits = Math.max(0.3, (pxPerCol - 5) / 7);
  for (let c = 1; c <= GRID_COLS; c++) {
    worksheet.getColumn(c).width = colWidthUnits;
  }

  // Row height is in points directly in Excel — a direct, precise mapping from the PDF's own
  // point-based page height.
  const rowHeightPt = pageHeightPt / GRID_ROWS;
  for (let r = 1; r <= GRID_ROWS; r++) {
    worksheet.getRow(r).height = rowHeightPt;
  }

  for (const block of page.blocks) {
    applyBlockToWorksheet(worksheet, block);
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
