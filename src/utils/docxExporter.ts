import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  IBorderOptions,
} from 'docx';
import { DocumentBlock, DocumentModel, DocumentPage } from '../types';

const NO_BORDERS: Record<'top' | 'bottom' | 'left' | 'right', IBorderOptions> = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

// Light slate, close to the gridlines typically used in invoices/forms.
const CELL_BORDER_COLOR = 'CBD5E1';
const THIN_BORDERS: Record<'top' | 'bottom' | 'left' | 'right', IBorderOptions> = {
  top: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 4, color: CELL_BORDER_COLOR },
};

function fillerCell(widthPct: number): TableCell {
  return new TableCell({
    width: { size: Math.max(0.1, Math.round(widthPct * 100) / 100), type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    children: [new Paragraph({ children: [] })],
  });
}

/**
 * A page is "grid-like" (a form/invoice/table of many discrete fields) rather than a flowing
 * document (a letter, a resume's prose sections) when it has a good number of blocks and most
 * of them are short — i.e. single fields, not multi-line paragraphs. Grid-like pages get a
 * spatial table reconstruction (see buildSpatialTable); everything else keeps the simpler
 * linear/sidebar flow, which suits genuinely flowing content better.
 */
function isGridLikePage(page: DocumentPage): boolean {
  const blocks = page.blocks.filter((b) => b.type !== 'divider');
  if (blocks.length < 10) return false;
  const shortBlocks = blocks.filter((b) => (b.height ?? 3) <= 8);
  return shortBlocks.length / blocks.length >= 0.6;
}

/**
 * Reconstructs a grid-like page as a real Word table: blocks are grouped into visual rows by
 * y-proximity (the way they'd read on the page), ordered left-to-right within each row, and
 * placed into cells sized from each block's own measured width — with a thin border on each
 * cell, matching the bordered fields/cells the source document actually has. Gaps between and
 * around blocks become plain, borderless filler cells so real spacing is preserved rather than
 * stretching content to fill it.
 */
function buildSpatialTable(page: DocumentPage): Table {
  const blocks = page.blocks
    .filter((b) => b.type !== 'divider' && ((b.content && b.content.trim()) || b.tableData))
    .slice()
    .sort((a, b) => {
      const ay = a.y ?? 0;
      const by = b.y ?? 0;
      if (Math.abs(ay - by) > 1.5) return ay - by;
      return (a.x ?? 0) - (b.x ?? 0);
    });

  const rows: DocumentBlock[][] = [];
  let currentRow: DocumentBlock[] = [];
  let currentRowY: number | null = null;

  for (const block of blocks) {
    const by = block.y ?? 0;
    const bh = block.height ?? 2.5;
    const tolerance = Math.max(1.5, bh * 0.6);
    if (currentRowY === null) {
      currentRow = [block];
      currentRowY = by;
    } else if (Math.abs(by - currentRowY) <= tolerance) {
      currentRow.push(block);
    } else {
      rows.push(currentRow);
      currentRow = [block];
      currentRowY = by;
    }
  }
  if (currentRow.length) rows.push(currentRow);

  const tableRows: TableRow[] = rows.map((rowBlocks) => {
    rowBlocks.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    const cells: TableCell[] = [];
    let cursor = 0;

    rowBlocks.forEach((block) => {
      let bx = Math.max(block.x ?? cursor, cursor);
      bx = Math.min(bx, 99);
      const gap = bx - cursor;
      if (gap > 2) cells.push(fillerCell(gap));

      const rawWidth = Math.max(block.width ?? 100 - bx, 3);
      const cellWidth = Math.min(rawWidth, 100 - bx);

      cells.push(
        new TableCell({
          width: { size: Math.round(cellWidth * 100) / 100, type: WidthType.PERCENTAGE },
          borders: block.type === 'h1' ? NO_BORDERS : THIN_BORDERS,
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children:
            block.type === 'table' && block.tableData
              ? convertBlockToDocxElements(block)
              : convertBlockToDocxElements(block),
        })
      );
      cursor = bx + cellWidth;
    });

    if (100 - cursor > 2) cells.push(fillerCell(100 - cursor));

    return new TableRow({ children: cells });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: tableRows,
  });
}

export async function exportToDocx(docModel: DocumentModel): Promise<Blob> {
  const sections = docModel.pages.map((page, pageIdx) => {
    const children: (Paragraph | Table)[] = [];

    // Optional page break between pages (except the first page)
    if (pageIdx > 0) {
      children.push(
        new Paragraph({
          pageBreakBefore: true,
        })
      );
    }

    if (isGridLikePage(page)) {
      // A form/invoice/table-style page: rebuild it as a real table so the original grid,
      // field positions, and cell borders survive in Word rather than becoming a flat list
      // of paragraphs in reading order.
      children.push(buildSpatialTable(page));
    } else {
      // Check if this page has multi-column / sidebar layout
      const isMultiColumn =
        page.hasMultiColumn ||
        page.blocks.some((b) => b.columnGroup === 'sidebar' || b.columnGroup === 'left');

      if (isMultiColumn) {
      // 1. Top Header Banner blocks (fixed at top: 0 to 18%)
      const headerBlocks = page.blocks.filter(
        (b) =>
          b.columnGroup === 'header' ||
          (!['sidebar', 'left', 'right'].includes(b.columnGroup || '') && (b.y || 0) < 18)
      );

      for (const block of headerBlocks) {
        children.push(...convertBlockToDocxElements(block));
      }

      // 2. Left / Sidebar column blocks (fixed at top: 18%, width: 35%)
      const leftBlocks = page.blocks.filter(
        (b) =>
          !headerBlocks.includes(b) &&
          (b.columnGroup === 'sidebar' ||
            b.columnGroup === 'left' ||
            ((b.x || 0) < 35 && (b.y || 0) >= 18))
      );

      // 3. Right / Main column blocks (fixed at top: 18%, left: 35%, width: 65%)
      const rightBlocks = page.blocks.filter(
        (b) => !headerBlocks.includes(b) && !leftBlocks.includes(b)
      );

      // Build 2-column Word Table with invisible borders to preserve sidebar and main content side-by-side
      const leftElements = leftBlocks.flatMap(convertBlockToDocxElements);
      const rightElements = rightBlocks.flatMap(convertBlockToDocxElements);

      // Automatically map the 35%/65% split into a borderless 2-column Word table
      const computedLeftWidth = 35;
      const computedRightWidth = 65;

      // Detect background panel shading from original layout
      const hasSidebarShading = leftBlocks.some(
        (b) => b.columnGroup === 'sidebar' || b.backgroundColor
      );
      const sidebarShadingHex =
        leftBlocks.find((b) => b.backgroundColor)?.backgroundColor?.replace('#', '') || 'F1F5F9';

      if (leftElements.length > 0 || rightElements.length > 0) {
        const layoutTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: computedLeftWidth, type: WidthType.PERCENTAGE },
                  margins: { right: 160, left: 140, top: 120, bottom: 120 },
                  shading: hasSidebarShading ? { fill: sidebarShadingHex } : undefined,
                  children:
                    leftElements.length > 0
                      ? leftElements
                      : [new Paragraph({ children: [] })],
                }),
                new TableCell({
                  width: { size: computedRightWidth, type: WidthType.PERCENTAGE },
                  margins: { left: 180, right: 100, top: 120, bottom: 120 },
                  children:
                    rightElements.length > 0
                      ? rightElements
                      : [new Paragraph({ children: [] })],
                }),
              ],
            }),
          ],
        });

        children.push(layoutTable);
      }
      } else {
        // Standard linear flow layout
        for (const block of page.blocks) {
          children.push(...convertBlockToDocxElements(block));
        }
      }
    }

    return {
      properties: {
        page: {
          margin: {
            top: 1200, // 20mm
            bottom: 1200,
            left: 1200,
            right: 1200,
          },
        },
      },
      children,
    };
  });

  const doc = new Document({
    title: docModel.title || 'Document',
    description: 'Converted from PDF with layout fidelity preserved',
    sections,
  });

  return await Packer.toBlob(doc);
}

function convertBlockToDocxElements(block: DocumentBlock): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
  if (block.align === 'center') alignment = AlignmentType.CENTER;
  if (block.align === 'right') alignment = AlignmentType.RIGHT;
  if (block.align === 'justify') alignment = AlignmentType.JUSTIFIED;

  switch (block.type) {
    case 'h1':
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: block.content,
              bold: true,
              size: (block.fontSize ? block.fontSize * 2 : 36),
              color: '1E293B',
            }),
          ],
        })
      );
      break;

    case 'h2':
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment,
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: block.content,
              bold: true,
              size: (block.fontSize ? block.fontSize * 2 : 28),
              color: '334155',
            }),
          ],
        })
      );
      break;

    case 'h3':
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          alignment,
          spacing: { before: 140, after: 60 },
          children: [
            new TextRun({
              text: block.content,
              bold: true,
              size: (block.fontSize ? block.fontSize * 2 : 24),
              color: block.textColor ? block.textColor.replace('#', '') : '4F46E5',
            }),
          ],
        })
      );
      break;

    case 'bullet':
      elements.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 50, after: 50 },
          children: [
            new TextRun({
              text: block.content,
              size: (block.fontSize ? block.fontSize * 2 : 22),
              color: '1E293B',
            }),
          ],
        })
      );
      break;

    case 'numbered':
      elements.push(
        new Paragraph({
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { before: 50, after: 50 },
          children: [
            new TextRun({
              text: block.content,
              size: (block.fontSize ? block.fontSize * 2 : 22),
              color: '1E293B',
            }),
          ],
        })
      );
      break;

    case 'callout':
      elements.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: {
            left: {
              color: '4F46E5',
              space: 12,
              style: BorderStyle.SINGLE,
              size: 24,
            },
          },
          children: [
            new TextRun({
              text: block.content,
              italics: true,
              size: (block.fontSize ? block.fontSize * 2 : 21),
              color: '4338CA',
            }),
          ],
        })
      );
      break;

    case 'divider':
      elements.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          border: {
            bottom: {
              color: 'E2E8F0',
              space: 4,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        })
      );
      break;

    case 'signature':
      elements.push(
        new Paragraph({
          spacing: { before: 240, after: 40 },
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: '____________________________',
              color: '94A3B8',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 30, after: 80 },
          children: [
            new TextRun({
              text: block.content,
              bold: true,
              size: 20,
              color: '1E293B',
            }),
          ],
        })
      );
      break;

    case 'table':
      if (block.tableData && block.tableData.headers && block.tableData.headers.length > 0) {
        const headerRow = new TableRow({
          tableHeader: true,
          children: block.tableData.headers.map(
            (headerText) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: headerText,
                        bold: true,
                        size: 20,
                        color: 'FFFFFF',
                      }),
                    ],
                  }),
                ],
                shading: {
                  fill: '3B82F6',
                },
                margins: {
                  top: 100,
                  bottom: 100,
                  left: 120,
                  right: 120,
                },
              })
          ),
        });

        const dataRows = (block.tableData.rows || []).map(
          (row, rIdx) =>
            new TableRow({
              children: row.map(
                (cellText) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: cellText,
                            size: 20,
                            color: '1E293B',
                          }),
                        ],
                      }),
                    ],
                    shading: {
                      fill: rIdx % 2 === 1 ? 'F8FAFC' : 'FFFFFF',
                    },
                    margins: {
                      top: 80,
                      bottom: 80,
                      left: 120,
                      right: 120,
                    },
                  })
              ),
            })
        );

        elements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          })
        );
      }
      break;

    case 'paragraph':
    default: {
      // Split multiline content cleanly
      const lines = (block.content || '').split('\n');
      lines.forEach((lineText, lIdx) => {
        elements.push(
          new Paragraph({
            alignment,
            spacing: { before: lIdx === 0 ? 60 : 30, after: 60 },
            children: [
              new TextRun({
                text: lineText,
                bold: block.isBold || false,
                italics: block.isItalic || false,
                underline: block.isUnderline ? {} : undefined,
                size: (block.fontSize ? block.fontSize * 2 : 22),
                color: block.textColor ? block.textColor.replace('#', '') : '334155',
              }),
            ],
          })
        );
      });
      break;
    }
  }

  return elements;
}
