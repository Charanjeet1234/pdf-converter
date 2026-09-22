import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { DocumentBlock, DocumentModel, DocumentPage } from '../types';

// Configure pdfjs worker with bundled local worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

interface TextItem {
  str: string;
  dir?: string;
  width?: number;
  height?: number;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, transX, transY]
  fontName?: string;
  hasEOL?: boolean;
}

interface RawSpatialSpan {
  text: string;
  x: number; // pt
  y: number; // pt from top
  width: number; // pt
  height: number; // pt
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
}

export async function parsePdfFile(file: File): Promise<DocumentModel> {
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

  let pdf;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });
    pdf = await loadingTask.promise;
  } catch (loadErr) {
    console.error('Failed to load PDF via pdfjs, falling back:', loadErr);
    return createFallbackDocumentFromFile(file, blob);
  }

  const numPages = pdf.numPages;
  const pages: DocumentPage[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;

      // 1. Render High-Resolution Background & Thumbnail
      let thumbnailUrl: string | undefined;
      let backgroundImageUrl: string | undefined;

      try {
        const bgCanvas = document.createElement('canvas');
        const bgContext = bgCanvas.getContext('2d');
        const hiResViewport = page.getViewport({ scale: 2.0 }); // 2.0x scale for razor-sharp background graphics
        bgCanvas.width = hiResViewport.width;
        bgCanvas.height = hiResViewport.height;

        if (bgContext) {
          // @ts-expect-error pdfjs render params
          await page.render({ canvasContext: bgContext, viewport: hiResViewport }).promise;
          backgroundImageUrl = bgCanvas.toDataURL('image/jpeg', 0.88);
          // Thumbnail uses smaller version
          thumbnailUrl = bgCanvas.toDataURL('image/jpeg', 0.45);
        }
      } catch (renderErr) {
        console.warn('Page background render warning for page', pageNum, renderErr);
      }

      // 2. Extract Text with Exact Spatial Coordinates
      const textContent = await page.getTextContent();
      const rawItems = (textContent.items || []) as TextItem[];

      const spans: RawSpatialSpan[] = [];

      for (const item of rawItems) {
        const str = (item.str || '').trim();
        if (!str) continue;

        // PDF coordinate system has (0, 0) at the bottom-left corner
        const scaleX = Math.abs(item.transform[0]) || 12;
        const scaleY = Math.abs(item.transform[3]) || 12;
        const fontSize = Math.round(Math.max(scaleX, scaleY));

        let itemX = item.transform[4];
        let itemY = pageHeight - item.transform[5] - (item.height || fontSize);

        // Normalize using PDF.js viewport transformation matrix if available
        if (viewport && typeof (viewport as any).convertToViewportPoint === 'function') {
          try {
            const [vx, vy] = (viewport as any).convertToViewportPoint(item.transform[4], item.transform[5]);
            itemX = vx;
            itemY = vy - (item.height || fontSize);
          } catch {
            // fallback to direct calculation
          }
        }

        const itemWidth = item.width ? item.width * (viewport.scale || 1.0) : (fontSize * str.length * 0.55);
        const itemHeight = item.height ? item.height * (viewport.scale || 1.0) : (fontSize * 1.2);
        const fontName = item.fontName || '';
        const isBold = /bold|heavy|black/i.test(fontName);
        const isItalic = /italic|oblique/i.test(fontName);

        spans.push({
          text: item.str,
          x: Math.max(0, itemX),
          y: Math.max(0, itemY),
          width: Math.max(1, itemWidth),
          height: Math.max(1, itemHeight),
          fontSize,
          fontName,
          isBold,
          isItalic,
        });
      }

      // 3. Multi-Column & Sidebar Detection
      // Check if text spans naturally divide into distinct horizontal bands (e.g. left column vs right column)
      let hasMultiColumn = false;
      const leftBoundary = pageWidth * 0.38;
      let leftItemsCount = 0;
      let rightItemsCount = 0;

      for (const span of spans) {
        if (span.y >= pageHeight * 0.18) {
          if (span.x < leftBoundary) {
            leftItemsCount++;
          } else {
            rightItemsCount++;
          }
        }
      }

      // If items exist on both left and right below header, it is a multi-column/sidebar layout
      if (spans.length >= 4 && leftItemsCount >= 2 && rightItemsCount >= 2) {
        hasMultiColumn = true;
      }

      // 4. Cluster Spans into Layout Blocks
      // Sort spans first by header vs column partition, then by Y position, then by X
      const sortedSpans = [...spans].sort((a, b) => {
        if (hasMultiColumn) {
          const isHeaderA = a.y < pageHeight * 0.18;
          const isHeaderB = b.y < pageHeight * 0.18;
          if (isHeaderA !== isHeaderB) return isHeaderA ? -1 : 1;

          const colA = a.x < leftBoundary ? 0 : 1;
          const colB = b.x < leftBoundary ? 0 : 1;
          if (colA !== colB) return colA - colB;
        }
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) > 4) return yDiff;
        return a.x - b.x;
      });

      // Cluster spatially adjacent lines with similar styles into cohesive blocks
      interface WorkingBlock {
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
        fontSize: number;
        isBold: boolean;
        isItalic: boolean;
        columnGroup: 'left' | 'right' | 'full' | 'sidebar' | 'header';
      }

      const workingBlocks: WorkingBlock[] = [];
      let currentWb: WorkingBlock | null = null;

      for (const span of sortedSpans) {
        const isHeader = span.y < pageHeight * 0.18;
        const isSidebar = !isHeader && (span.x < leftBoundary || (span.x + span.width * 0.5) < leftBoundary);
        const spanCol: 'left' | 'right' | 'full' | 'sidebar' | 'header' = !hasMultiColumn
          ? 'full'
          : isHeader
          ? 'header'
          : isSidebar
          ? 'sidebar'
          : 'right';

        if (!currentWb) {
          currentWb = {
            text: span.text,
            x: span.x,
            y: span.y,
            width: span.width,
            height: span.height,
            fontSize: span.fontSize,
            isBold: span.isBold,
            isItalic: span.isItalic,
            columnGroup: spanCol,
          };
          continue;
        }

        // Determine if this span continues the current block:
        // Same column group, vertical gap <= fontSize * 1.6, and similar font size
        const verticalGap = span.y - (currentWb.y + currentWb.height);
        const isSameColumn = currentWb.columnGroup === spanCol;
        const isSameLine = Math.abs(currentWb.y - span.y) < 5;
        const isNextLine = verticalGap >= -2 && verticalGap < currentWb.fontSize * 1.6;
        const isSameStyle = currentWb.isBold === span.isBold && Math.abs(currentWb.fontSize - span.fontSize) <= 3;

        if (isSameColumn && (isSameLine || (isNextLine && isSameStyle))) {
          // Append text
          const needsSpace =
            !currentWb.text.endsWith(' ') &&
            !span.text.startsWith(' ') &&
            !currentWb.text.endsWith('-') &&
            !span.text.startsWith(',');
          currentWb.text += (needsSpace ? ' ' : '') + span.text;
          // Expand bounding box
          const rightX = Math.max(currentWb.x + currentWb.width, span.x + span.width);
          currentWb.x = Math.min(currentWb.x, span.x);
          currentWb.width = rightX - currentWb.x;
          currentWb.height = Math.max(currentWb.height, span.y + span.height - currentWb.y);
        } else {
          // Flush current block
          if (currentWb.text.trim()) {
            workingBlocks.push(currentWb);
          }
          currentWb = {
            text: span.text,
            x: span.x,
            y: span.y,
            width: span.width,
            height: span.height,
            fontSize: span.fontSize,
            isBold: span.isBold,
            isItalic: span.isItalic,
            columnGroup: spanCol,
          };
        }
      }

      if (currentWb && currentWb.text.trim()) {
        workingBlocks.push(currentWb);
      }

      // 5. Convert working blocks into DocumentBlocks with relative percentage coordinates
      const blocks: DocumentBlock[] = workingBlocks.map((wb, idx) => {
        const text = wb.text.trim();
        const xPct = Math.max(0, Math.min(95, (wb.x / pageWidth) * 100));
        const yPct = Math.max(0, Math.min(95, (wb.y / pageHeight) * 100));
        const widthPct = Math.max(5, Math.min(100 - xPct, (wb.width / pageWidth) * 100));
        const heightPct = Math.max(1.5, (wb.height / pageHeight) * 100);

        // Classify block type based on font size and formatting
        let blockType: DocumentBlock['type'] = 'paragraph';
        if (wb.fontSize >= 18) {
          blockType = 'h1';
        } else if (wb.fontSize >= 14) {
          blockType = 'h2';
        } else if (wb.fontSize >= 12 && (wb.isBold || text.length < 50)) {
          blockType = 'h3';
        } else if (/^([•\-*▪▫]|\d+\.)\s+/.test(text)) {
          blockType = /^\d+\./.test(text) ? 'numbered' : 'bullet';
        }

        const cleanText = text.replace(/^([•\-*▪▫]|\d+\.)\s+/, '');

        return {
          id: `p${pageNum}-b${idx + 1}`,
          type: blockType,
          content: cleanText || text,
          originalContent: cleanText || text,
          isBold: wb.isBold,
          isItalic: wb.isItalic,
          fontSize: wb.fontSize,
          x: Math.round(xPct * 100) / 100,
          y: Math.round(yPct * 100) / 100,
          width: Math.round(widthPct * 100) / 100,
          height: Math.round(heightPct * 100) / 100,
          columnGroup: wb.columnGroup,
          isSpatial: true,
          align: 'left',
        };
      });

      // Fallback if no text extracted
      if (blocks.length === 0) {
        blocks.push({
          id: `p${pageNum}-b1`,
          type: 'callout',
          content: `Page ${pageNum} imported. Use the top toolbar to add headings, paragraphs, or editable tables.`,
          x: 8,
          y: 8,
          width: 84,
          isSpatial: true,
        });
      }

      pages.push({
        id: `page-${pageNum}-${Date.now()}`,
        pageNumber: pageNum,
        blocks,
        thumbnailUrl,
        backgroundImageUrl,
        layoutMode: 'spatial',
        width: pageWidth,
        height: pageHeight,
        hasMultiColumn,
        rotation: 0,
      });
    } catch (pageErr) {
      console.warn(`Error parsing page ${pageNum}:`, pageErr);
      pages.push({
        id: `page-${pageNum}-${Date.now()}`,
        pageNumber: pageNum,
        blocks: [
          {
            id: `p${pageNum}-err`,
            type: 'paragraph',
            content: `Page ${pageNum} loaded.`,
            isSpatial: true,
            x: 10,
            y: 10,
            width: 80,
          },
        ],
        layoutMode: 'spatial',
        rotation: 0,
      });
    }
  }

  return {
    id: `doc-${Date.now()}`,
    title: file.name.replace(/\.[^/.]+$/, ''),
    sourceType: 'uploaded_pdf',
    pageCount: pages.length,
    pages,
    lastModified: Date.now(),
    originalPdfBlob: blob,
    originalFileName: file.name,
    activeLayoutMode: 'spatial',
  };
}

function createFallbackDocumentFromFile(file: File, blob: Blob): DocumentModel {
  return {
    id: `doc-${Date.now()}`,
    title: file.name.replace(/\.[^/.]+$/, ''),
    sourceType: 'uploaded_pdf',
    pageCount: 1,
    originalPdfBlob: blob,
    originalFileName: file.name,
    lastModified: Date.now(),
    activeLayoutMode: 'spatial',
    pages: [
      {
        id: `page-1-${Date.now()}`,
        pageNumber: 1,
        rotation: 0,
        layoutMode: 'spatial',
        blocks: [
          {
            id: 'b1',
            type: 'h1',
            content: file.name.replace(/\.[^/.]+$/, ''),
            isBold: true,
            x: 10,
            y: 8,
            width: 80,
            isSpatial: true,
          },
          {
            id: 'b2',
            type: 'callout',
            content: 'Document loaded into the local editor. Click any element to edit inline.',
            x: 10,
            y: 18,
            width: 80,
            isSpatial: true,
          },
        ],
      },
    ],
  };
}
