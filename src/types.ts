export type BlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'callout'
  | 'divider'
  | 'table'
  | 'signature'
  | 'image';

export interface TableCellData {
  text: string;
}

export interface TableRowData {
  cells: TableCellData[];
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface DocumentBlock {
  id: string;
  type: BlockType;
  content: string;
  originalContent?: string;
  tableData?: TableData;
  imageUrl?: string;
  imageCaption?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  textColor?: string;
  backgroundColor?: string;

  // Layout & Spatial Coordinates (for 100% layout fidelity)
  x?: number; // percentage from left (0 - 100)
  y?: number; // percentage from top (0 - 100)
  width?: number; // percentage width (0 - 100)
  height?: number; // percentage height (0 - 100)
  fontSize?: number; // font size in px/pt
  fontFamily?: string;
  fontWeight?: string | number;
  columnGroup?: 'left' | 'right' | 'full' | 'sidebar' | 'header' | 'footer';
  isSpatial?: boolean; // true if extracted from spatial PDF coordinates
  isSingleLine?: boolean; // true if this text was one visual line in the source PDF (never wraps in the editor)
}

export interface DocumentPage {
  id: string;
  pageNumber: number;
  blocks: DocumentBlock[];
  thumbnailUrl?: string;
  backgroundImageUrl?: string; // High-resolution rendered page background layer
  layoutMode?: 'spatial' | 'flow';
  width?: number; // in pt (e.g. 595.28 for A4)
  height?: number; // in pt (e.g. 841.89 for A4)
  rotation?: number; // 0, 90, 180, 270
  hasMultiColumn?: boolean;
}

export interface DocumentModel {
  id: string;
  title: string;
  sourceType: 'uploaded_pdf' | 'created_blank' | 'sample';
  pageCount: number;
  pages: DocumentPage[];
  lastModified: number;
  originalPdfBlob?: Blob;
  originalFileName?: string;
  activeLayoutMode?: 'spatial' | 'flow';
}

export type ExportFormat = 'docx' | 'pdf' | 'html' | 'txt' | 'markdown' | 'png' | 'xlsx';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}
