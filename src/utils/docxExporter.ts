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
} from 'docx';
import { DocumentBlock, DocumentModel, DocumentPage } from '../types';

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
