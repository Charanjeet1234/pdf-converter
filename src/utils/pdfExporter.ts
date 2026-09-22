import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { DocumentModel } from '../types';

export interface PdfExportOptions {
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  includePageNumbers?: boolean;
  headerTitle?: boolean;
  useDomCanvas?: boolean; // When true, captures exact WYSIWYG DOM for 100% layout fidelity
}

/**
 * Sanitizes text to avoid WinAnsi encoding issues in jsPDF standard fonts.
 */
function cleanPdfText(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/\u2026/g, '...')
    .replace(/^[•\-*▪▫]\s*/, '')
    .trim();
}

/**
 * High-fidelity PDF exporter.
 * If the WYSIWYG DOM elements are mounted, captures each page sheet at 2.5x resolution
 * to guarantee 100% layout fidelity, exact columns, sidebars, colors, fonts, and inline edits.
 * Falls back to spatial vector rendering if DOM is unavailable.
 */
export async function exportToPdf(
  docModel: DocumentModel,
  options: PdfExportOptions = {}
): Promise<Blob> {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
    includePageNumbers = true,
    headerTitle = true,
    useDomCanvas = true,
  } = options;

  // Check if WYSIWYG DOM page elements exist in the document
  const firstPageDom = typeof document !== 'undefined' ? document.getElementById('page-sheet-1') : null;

  if (useDomCanvas && firstPageDom && typeof document !== 'undefined') {
    try {
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: pageSize,
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let pageIdx = 0; pageIdx < docModel.pages.length; pageIdx++) {
        const domElement = document.getElementById(`page-sheet-${pageIdx + 1}`);

        if (pageIdx > 0) {
          pdf.addPage(pageSize, orientation);
        }

        if (domElement) {
          // Temporarily hide hover/interactive action buttons during capture
          const actionToolbars = domElement.querySelectorAll<HTMLElement>('[id^="block-actions-"], [id^="spatial-toolbar-"]');
          actionToolbars.forEach((el) => {
            el.style.display = 'none';
          });

          // Capture high-DPI canvas
          const canvas = await html2canvas(domElement, {
            scale: 2.2, // ~200+ DPI sharp print quality
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 1200,
          });

          // Restore toolbars
          actionToolbars.forEach((el) => {
            el.style.display = '';
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        } else {
          // Fallback for missing page DOM
          renderVectorPage(pdf, docModel, pageIdx, pdfWidth, pdfHeight, includePageNumbers, headerTitle);
        }
      }

      const pdfOutput = pdf.output('arraybuffer');
      return new Blob([pdfOutput], { type: 'application/pdf' });
    } catch (domErr) {
      console.warn('DOM canvas export encountered error, falling back to spatial vector export:', domErr);
    }
  }

  // Pure Spatial & Vector Fallback
  return exportVectorPdf(docModel, options);
}

function exportVectorPdf(
  docModel: DocumentModel,
  options: PdfExportOptions = {}
): Promise<Blob> {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
    includePageNumbers = true,
    headerTitle = true,
  } = options;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize,
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  docModel.pages.forEach((_, pageIdx) => {
    if (pageIdx > 0) {
      pdf.addPage(pageSize, orientation);
    }
    renderVectorPage(pdf, docModel, pageIdx, pageWidth, pageHeight, includePageNumbers, headerTitle);
  });

  const pdfOutput = pdf.output('arraybuffer');
  return Promise.resolve(new Blob([pdfOutput], { type: 'application/pdf' }));
}

function renderVectorPage(
  pdf: jsPDF,
  docModel: DocumentModel,
  pageIdx: number,
  pageWidth: number,
  pageHeight: number,
  includePageNumbers: boolean,
  headerTitle: boolean
) {
  const page = docModel.pages[pageIdx];
  const totalPages = docModel.pages.length;
  const marginLeft = 18;
  const marginRight = 18;
  const marginTop = 22;
  const marginBottom = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // Background image if present
  if (page.backgroundImageUrl) {
    try {
      pdf.addImage(page.backgroundImageUrl, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    } catch (e) {
      console.warn('Could not add background image to vector PDF', e);
    }
  }

  // Header Title
  if (headerTitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    const safeDocTitle = cleanPdfText(docModel.title || 'Document').toUpperCase();
    pdf.text(safeDocTitle, marginLeft, 12);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(marginLeft, 14, pageWidth - marginRight, 14);
  }

  // Footer
  if (includePageNumbers) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Page ${pageIdx + 1} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // Check if blocks have spatial coordinates
  const isSpatialPage = page.layoutMode === 'spatial' || page.blocks.some((b) => b.isSpatial && b.x !== undefined);

  if (isSpatialPage) {
    // Render blocks by relative percentage coordinates
    for (const block of page.blocks) {
      const cleanContent = cleanPdfText(block.content);
      if (!cleanContent && block.type !== 'divider') continue;

      const blockX = block.x !== undefined ? (block.x / 100) * pageWidth : marginLeft;
      const blockY = block.y !== undefined ? (block.y / 100) * pageHeight : marginTop;
      const blockW = block.width !== undefined ? (block.width / 100) * pageWidth : contentWidth;

      renderSingleBlock(pdf, block, cleanContent, blockX, blockY, blockW);
    }
  } else {
    // Linear flow layout
    let currentY = marginTop;
    for (const block of page.blocks) {
      const cleanContent = cleanPdfText(block.content);
      if (currentY > pageHeight - marginBottom - 15) {
        pdf.addPage('a4', 'portrait');
        currentY = marginTop;
      }
      currentY = renderFlowBlock(pdf, block, cleanContent, marginLeft, currentY, contentWidth);
    }
  }
}

function renderSingleBlock(
  pdf: jsPDF,
  block: DocumentModel['pages'][0]['blocks'][0],
  text: string,
  x: number,
  y: number,
  width: number
) {
  switch (block.type) {
    case 'h1': {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(block.fontSize || 18);
      pdf.setTextColor(15, 23, 42);
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, x, y);
      break;
    }
    case 'h2': {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(block.fontSize || 14);
      pdf.setTextColor(30, 41, 59);
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, x, y);
      break;
    }
    case 'h3': {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(block.fontSize || 11);
      pdf.setTextColor(79, 70, 229); // Accent indigo
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, x, y);
      break;
    }
    case 'bullet': {
      pdf.setFillColor(79, 70, 229);
      pdf.circle(x + 2, y - 1, 0.7, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(block.fontSize || 10);
      pdf.setTextColor(30, 41, 59);
      const lines = pdf.splitTextToSize(text, width - 6);
      pdf.text(lines, x + 6, y);
      break;
    }
    case 'callout': {
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(99, 102, 241);
      pdf.setLineWidth(0.8);
      const lines = pdf.splitTextToSize(text, width - 8);
      const blockHeight = lines.length * 4.5 + 4;
      pdf.roundedRect(x, y - 4, width, blockHeight, 1.5, 1.5, 'FD');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(block.fontSize || 9.5);
      pdf.setTextColor(67, 56, 202);
      pdf.text(lines, x + 4, y);
      break;
    }
    case 'divider': {
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(x, y, x + width, y);
      break;
    }
    default: {
      pdf.setFont('helvetica', block.isItalic ? 'italic' : block.isBold ? 'bold' : 'normal');
      pdf.setFontSize(block.fontSize || 10);
      pdf.setTextColor(51, 65, 85);
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, x, y);
      break;
    }
  }
}

function renderFlowBlock(
  pdf: jsPDF,
  block: DocumentModel['pages'][0]['blocks'][0],
  text: string,
  x: number,
  y: number,
  width: number
): number {
  if (!text && block.type !== 'divider') return y;

  switch (block.type) {
    case 'h1': {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42);
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, x, y);
      return y + lines.length * 7 + 4;
    }
    case 'h2': {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, x, y);
      return y + lines.length * 6 + 3;
    }
    case 'h3': {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(51, 65, 85);
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, x, y);
      return y + lines.length * 5 + 2;
    }
    case 'bullet': {
      pdf.setFillColor(79, 70, 229);
      pdf.circle(x + 2.5, y - 1.2, 0.8, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      const lines = pdf.splitTextToSize(text, width - 8);
      pdf.text(lines, x + 7, y);
      return y + lines.length * 5 + 2;
    }
    case 'divider': {
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(x, y + 2, x + width, y + 2);
      return y + 8;
    }
    default: {
      pdf.setFont('helvetica', block.isItalic ? 'italic' : block.isBold ? 'bold' : 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
      const lines = pdf.splitTextToSize(text, width);
      pdf.text(lines, x, y);
      return y + lines.length * 4.8 + 3;
    }
  }
}
