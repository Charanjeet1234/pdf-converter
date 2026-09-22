import React, { useState, useRef, useEffect } from 'react';
import { DocumentBlock, DocumentPage, BlockType } from '../types';
import {
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Columns,
  Layers,
} from 'lucide-react';

interface DocumentPageCanvasProps {
  page: DocumentPage;
  pageIndex: number;
  totalPages: number;
  zoom: number;
  onUpdateBlock: (blockId: string, updates: Partial<DocumentBlock>) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
  onDuplicateBlock: (blockId: string) => void;
  onInsertBlockAfter: (afterBlockId: string, type: BlockType) => void;
  activeBlockId: string | null;
  onSetActiveBlockId: (id: string | null) => void;
  onTogglePageLayoutMode?: (pageId: string, mode: 'spatial' | 'flow') => void;
  isActivePage?: boolean;
}

export const DocumentPageCanvas: React.FC<DocumentPageCanvasProps> = ({
  page,
  pageIndex,
  totalPages,
  zoom,
  onUpdateBlock,
  onDeleteBlock,
  activeBlockId,
  onSetActiveBlockId,
  isActivePage = true,
}) => {
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pdfPageImageDataUrl = page.backgroundImageUrl || page.thumbnailUrl;

  // The page sheet is always rendered at a fixed 794px width (see the "Standard A4 Paper
  // Sheet" div below). Font sizes measured off a real PDF are in points, taken from a page
  // that is `page.width` points wide — so a raw point value can't be used as a pixel value
  // directly, or text renders at the wrong size the moment it becomes visible (i.e. once
  // edited). Scale it by the same ratio the page itself is being displayed at. Hand-authored
  // pages (like the built-in sample) have no `page.width` in points and were authored with
  // font sizes already meant as CSS pixels, so they're left unscaled.
  const PAGE_CSS_WIDTH = 794;
  const fontScale = page.width ? PAGE_CSS_WIDTH / page.width : 1;

  // Fallback canvas rendering only if no background image is available
  useEffect(() => {
    if (pdfPageImageDataUrl) return; // Background image handles everything at z-10

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-resolution canvas buffer: 2x resolution of 794x1123 A4 sheet (1588x2246)
    canvas.width = 1588;
    canvas.height = 2246;

    // High-fidelity backdrop rendering if no image is available
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (page.hasMultiColumn) {
      // Top header banner accent (Dark Green #064e3b)
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.18);

      // Left Sidebar 35% Panel (Soft Gray #f8fafc)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, canvas.height * 0.18, canvas.width * 0.35, canvas.height * 0.82);

      // Vertical divider
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width * 0.35, canvas.height * 0.18);
      ctx.lineTo(canvas.width * 0.35, canvas.height);
      ctx.stroke();
    }
  }, [pdfPageImageDataUrl, page.hasMultiColumn]);

  // Table manipulation helpers
  const handleTableCellChange = (
    block: DocumentBlock,
    rowIndex: number,
    colIndex: number,
    value: string
  ) => {
    if (!block.tableData) return;
    const newRows = block.tableData.rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      return row.map((cell, cIdx) => (cIdx === colIndex ? value : cell));
    });
    onUpdateBlock(block.id, {
      tableData: {
        ...block.tableData,
        rows: newRows,
      },
    });
  };

  const handleTableHeaderChange = (
    block: DocumentBlock,
    colIndex: number,
    value: string
  ) => {
    if (!block.tableData) return;
    const newHeaders = [...block.tableData.headers];
    newHeaders[colIndex] = value;
    onUpdateBlock(block.id, {
      tableData: {
        ...block.tableData,
        headers: newHeaders,
      },
    });
  };

  const handleAddTableRow = (block: DocumentBlock) => {
    if (!block.tableData) return;
    const emptyRow = new Array(block.tableData.headers.length).fill('New item');
    onUpdateBlock(block.id, {
      tableData: {
        ...block.tableData,
        rows: [...block.tableData.rows, emptyRow],
      },
    });
  };

  const handleRemoveTableRow = (block: DocumentBlock, rowIndex: number) => {
    if (!block.tableData || block.tableData.rows.length <= 1) return;
    const newRows = block.tableData.rows.filter((_, idx) => idx !== rowIndex);
    onUpdateBlock(block.id, {
      tableData: {
        ...block.tableData,
        rows: newRows,
      },
    });
  };

  const handleAddTableColumn = (block: DocumentBlock) => {
    if (!block.tableData) return;
    const newHeaders = [...block.tableData.headers, `Col ${block.tableData.headers.length + 1}`];
    const newRows = block.tableData.rows.map((row) => [...row, '-']);
    onUpdateBlock(block.id, {
      tableData: {
        headers: newHeaders,
        rows: newRows,
      },
    });
  };

  return (
    <div
      id={`page-sheet-container-${pageIndex + 1}`}
      className="flex flex-col items-center py-3 px-2 transition-all select-none"
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: 'top center',
      }}
    >
      {/* External Page Metadata Bar */}
      <div className="w-[794px] max-w-full flex justify-between items-center text-xs text-slate-500 mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">
            Page {pageIndex + 1} of {totalPages}
          </span>
          {page.hasMultiColumn && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium text-[11px]">
              <Columns className="w-3 h-3 text-indigo-600" />
              Multi-Column Detected
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium text-[11px]">
            <Layers className="w-3 h-3 text-emerald-600" />
            WYSIWYG Overlay Active
          </span>
        </div>

        <div className="text-[11px] text-slate-400 font-medium">
          Click any text to edit inline
        </div>
      </div>

      {/* Standard A4 Paper Sheet (794px x 1123px at 96 DPI) */}
      <div
        id={`page-sheet-${pageIndex + 1}`}
        className={`relative w-[794px] h-[1123px] shadow-2xl border border-slate-200/80 bg-white mx-auto overflow-hidden select-text ${
          isActivePage ? 'ring-2 ring-indigo-500/50 shadow-indigo-100/50' : 'hover:shadow-3xl'
        }`}
        style={{
          transform: page.rotation ? `rotate(${page.rotation}deg)` : undefined,
        }}
        onClick={() => onSetActiveBlockId(null)}
      >
        {/* 1. Base Background Layer (z-index: 10) */}
        {pdfPageImageDataUrl ? (
          <img
            src={pdfPageImageDataUrl}
            alt={`Page ${pageIndex + 1} Background`}
            className="absolute top-0 left-0 w-full h-full object-fill z-10 pointer-events-none select-none"
          />
        ) : (
          <canvas
            id={`page-pdf-canvas-${pageIndex + 1}`}
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none"
          />
        )}

        {/* 2. Text Overlay Layer (z-index: 20)
              Every block is positioned using the exact page-relative x/y/width/height that was
              measured straight off the PDF's own text coordinates. We deliberately do NOT
              re-map blocks into a "header banner + sidebar + main column" zone system: that
              remapping assumes a layout the document may not actually have, and re-deriving a
              position from a guessed zone is a second source of drift on top of the original
              measurement — which is what made edit boxes appear detached from the real text.
              Keeping the raw coordinates is what keeps a block exactly where it visually is. */}
        {(() => {
          const renderSpatialBlock = (block: DocumentBlock) => {
            const isActive = activeBlockId === block.id;
            const isHovered = hoveredBlockId === block.id;
            const isEdited =
              block.originalContent !== undefined &&
              block.content !== block.originalContent;

            const relLeft = block.x ?? 5;
            const relTop = block.y ?? 5;
            const relWidth = block.width ?? 90;
            const relMinHeight = block.height ?? 2;
            const maskBg = '#ffffff';

            return (
              <div
                key={block.id}
                id={`block-${block.id}`}
                onMouseEnter={() => setHoveredBlockId(block.id)}
                onMouseLeave={() => setHoveredBlockId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetActiveBlockId(block.id);
                }}
                style={{
                  position: 'absolute',
                  left: `${relLeft}%`,
                  top: `${relTop}%`,
                  width: `${relWidth}%`,
                  minHeight: `${relMinHeight}%`,
                  zIndex: isActive ? 35 : isHovered ? 25 : 20,
                  backgroundColor: isActive || isEdited ? maskBg : 'transparent',
                }}
                className={`pointer-events-auto rounded-xs transition-all duration-75 ${
                  isActive
                    ? 'ring-2 ring-indigo-500 shadow-md'
                    : isHovered
                    ? 'ring-1 ring-indigo-300 bg-indigo-50/40 cursor-text'
                    : 'bg-transparent hover:ring-1 hover:ring-slate-300/60'
                }`}
              >
                {/* Floating Action Toolbar on active or hover */}
                {(isActive || isHovered) && (
                  <div
                    id={`block-actions-${block.id}`}
                    className="absolute -top-7 left-0 z-50 flex items-center gap-1 bg-white border border-slate-200 shadow-lg rounded-md px-1.5 py-0.5 text-[10px] animate-in fade-in select-none whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onUpdateBlock(block.id, { isBold: !block.isBold })}
                      className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                        block.isBold ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-600'
                      }`}
                      title="Toggle Bold"
                    >
                      <Bold className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => onUpdateBlock(block.id, { isItalic: !block.isItalic })}
                      className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                        block.isItalic ? 'bg-indigo-50 text-indigo-600 italic' : 'text-slate-600'
                      }`}
                      title="Toggle Italic"
                    >
                      <Italic className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => {
                        const newSize = Math.max(8, (block.fontSize || 12) - 1);
                        onUpdateBlock(block.id, { fontSize: newSize });
                      }}
                      className="px-1 text-slate-600 hover:bg-slate-100 rounded font-semibold text-[10px] cursor-pointer"
                      title="Decrease Font Size"
                    >
                      A-
                    </button>

                    <button
                      onClick={() => {
                        const newSize = Math.min(36, (block.fontSize || 12) + 1);
                        onUpdateBlock(block.id, { fontSize: newSize });
                      }}
                      className="px-1 text-slate-600 hover:bg-slate-100 rounded font-semibold text-[10px] cursor-pointer"
                      title="Increase Font Size"
                    >
                      A+
                    </button>

                    <div className="h-3 w-px bg-slate-200 mx-0.5" />

                    <button
                      onClick={() => onUpdateBlock(block.id, { align: 'left' })}
                      className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                        !block.align || block.align === 'left' ? 'text-indigo-600' : 'text-slate-500'
                      }`}
                      title="Align Left"
                    >
                      <AlignLeft className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => onUpdateBlock(block.id, { align: 'center' })}
                      className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                        block.align === 'center' ? 'text-indigo-600' : 'text-slate-500'
                      }`}
                      title="Align Center"
                    >
                      <AlignCenter className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => onUpdateBlock(block.id, { align: 'right' })}
                      className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                        block.align === 'right' ? 'text-indigo-600' : 'text-slate-500'
                      }`}
                      title="Align Right"
                    >
                      <AlignRight className="w-3 h-3" />
                    </button>

                    <div className="h-3 w-px bg-slate-200 mx-0.5" />

                    <button
                      onClick={() => onDeleteBlock(block.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      title="Delete Block"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Block Content */}
                {block.type === 'table' && block.tableData ? (
                  renderTableBlock(
                    block,
                    handleTableCellChange,
                    handleTableHeaderChange,
                    handleAddTableRow,
                    handleRemoveTableRow,
                    handleAddTableColumn
                  )
                ) : block.type === 'divider' ? (
                  <hr className="border-t border-slate-300 my-1 pointer-events-none" />
                ) : (
                  <textarea
                    value={block.content}
                    onChange={(e) => onUpdateBlock(block.id, { content: e.target.value })}
                    placeholder="Type here..."
                    rows={1}
                    wrap={block.isSingleLine ? 'off' : 'soft'}
                    className={`w-full bg-transparent resize-none outline-hidden leading-tight rounded-xs transition-colors p-0.5 ${
                      isActive ? 'border-b border-indigo-500' : 'border-b border-transparent'
                    }`}
                    style={{
                      fontSize: `${(block.fontSize ?? 13) * fontScale}px`,
                      fontWeight: block.isBold ? 700 : block.fontWeight || (block.type.startsWith('h') ? 600 : 400),
                      fontStyle: block.isItalic ? 'italic' : 'normal',
                      // The rasterized page image underneath already shows this text pixel-for-pixel.
                      // Only reveal this editable overlay's own text once it diverges from that image
                      // (actively being edited, or already edited) — otherwise both layers render at
                      // once and the page looks doubled/garbled.
                      color: isActive || isEdited
                        ? block.textColor || '#0f172a'
                        : 'transparent',
                      textAlign: block.align || 'left',
                      fontFamily: block.fontFamily || 'inherit',
                      lineHeight: '1.25',
                      caretColor: '#4f46e5',
                      // A block that was a single visual line in the source PDF must stay that
                      // way: measured width is only ever an estimate, and letting a "one line"
                      // field wrap onto a second line makes its box grow taller and spill over
                      // whatever sits below it on the page. Overflowing sideways instead is far
                      // less disruptive than that, and rarely triggers now that width includes
                      // a safety margin.
                      whiteSpace: block.isSingleLine ? 'pre' : 'pre-wrap',
                      overflow: block.isSingleLine ? 'hidden' : 'visible',
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = `${Math.max(el.scrollHeight, 18)}px`;
                      }
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.max(target.scrollHeight, 18)}px`;
                    }}
                  />
                )}
              </div>
            );
          };

          return (
            <div
              id={`page-${pageIndex + 1}-text-overlay-layer`}
              className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none"
            >
              {page.blocks.map((block) => renderSpatialBlock(block))}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

/**
 * Renders editable table component
 */
function renderTableBlock(
  block: DocumentBlock,
  handleTableCellChange: (block: DocumentBlock, r: number, c: number, val: string) => void,
  handleTableHeaderChange: (block: DocumentBlock, c: number, val: string) => void,
  handleAddTableRow: (block: DocumentBlock) => void,
  handleRemoveTableRow: (block: DocumentBlock, r: number) => void,
  handleAddTableColumn: (block: DocumentBlock) => void
) {
  if (!block.tableData) return null;

  return (
    <div className="my-1 overflow-x-auto border border-slate-200 rounded-lg shadow-2xs bg-white/95">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700">
            {block.tableData.headers.map((hdr, cIdx) => (
              <th key={cIdx} className="p-2 font-bold border-r border-slate-200 last:border-r-0">
                <input
                  type="text"
                  value={hdr}
                  onChange={(e) => handleTableHeaderChange(block, cIdx, e.target.value)}
                  className="w-full bg-transparent font-bold outline-hidden"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.tableData.rows.map((row, rIdx) => (
            <tr key={rIdx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="p-2 border-r border-slate-100 last:border-r-0">
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => handleTableCellChange(block, rIdx, cIdx, e.target.value)}
                    className="w-full bg-transparent outline-hidden text-slate-700"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Table Row Controls */}
      <div className="p-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAddTableRow(block)}
            className="hover:text-indigo-600 font-medium px-1.5 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
          >
            + Add Row
          </button>
          <button
            onClick={() => handleAddTableColumn(block)}
            className="hover:text-indigo-600 font-medium px-1.5 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
          >
            + Add Column
          </button>
        </div>
        {block.tableData.rows.length > 1 && (
          <button
            onClick={() => handleRemoveTableRow(block, block.tableData!.rows.length - 1)}
            className="hover:text-rose-600 font-medium px-1.5 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
          >
            - Delete Row
          </button>
        )}
      </div>
    </div>
  );
}
