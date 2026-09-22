import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DocumentModel,
  DocumentPage,
  DocumentBlock,
  BlockType,
  ExportFormat,
  ToastMessage,
} from './types';
import { SAMPLE_DOCUMENT } from './utils/sampleData';
import { parsePdfFile } from './utils/pdfParser';
import { exportToDocx } from './utils/docxExporter';
import { exportToPdf, PdfExportOptions } from './utils/pdfExporter';
import {
  exportToHtml,
  exportToMarkdown,
  exportToPlainText,
  triggerDownload,
  openBlobInNewTab,
  sanitizeFilename,
} from './utils/otherExporters';
import {
  saveDocumentToStorage,
  loadDocumentFromStorage,
  createBlankDocument,
} from './utils/storage';

import { Navbar } from './components/Navbar';
import { EditorToolbar } from './components/EditorToolbar';
import { PageThumbnails } from './components/PageThumbnails';
import { DocumentPageCanvas } from './components/DocumentPageCanvas';
import { Dropzone } from './components/Dropzone';
import { ExportModal } from './components/ExportModal';
import { DocxQuickConverterModal } from './components/DocxQuickConverterModal';
import { ToastContainer } from './components/Toast';

export default function App() {
  // Document state initialized from local storage or sample
  const [docModel, setDocModel] = useState<DocumentModel>(() => {
    const saved = loadDocumentFromStorage();
    return saved || SAMPLE_DOCUMENT;
  });

  // History stack for Undo/Redo
  const [history, setHistory] = useState<DocumentModel[]>([docModel]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Active page & block
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // Canvas zoom
  const [zoom, setZoom] = useState(1.0);

  // Modals & Views
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('docx');
  const [isDocxQuickModalOpen, setIsDocxQuickModalOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Add toast helper
  const showToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Push new state to history & save to local storage
  const updateDocument = useCallback(
    (
      newDocOrFn: DocumentModel | ((prev: DocumentModel) => DocumentModel),
      addToHistory = true
    ) => {
      setDocModel((prevDoc) => {
        const nextDoc =
          typeof newDocOrFn === 'function' ? newDocOrFn(prevDoc) : newDocOrFn;

        saveDocumentToStorage(nextDoc);

        if (addToHistory) {
          setHistory((prevHist) => {
            const trimmed = prevHist.slice(0, historyIndex + 1);
            return [...trimmed, nextDoc].slice(-30); // keep up to 30 snapshots
          });
          setHistoryIndex((prevIdx) => Math.min(prevIdx + 1, 29));
        }

        return nextDoc;
      });
    },
    [historyIndex]
  );

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const targetDoc = history[newIndex];
      setHistoryIndex(newIndex);
      setDocModel(targetDoc);
      saveDocumentToStorage(targetDoc);
      showToast('info', 'Undo applied');
    }
  }, [historyIndex, history, showToast]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const targetDoc = history[newIndex];
      setHistoryIndex(newIndex);
      setDocModel(targetDoc);
      saveDocumentToStorage(targetDoc);
      showToast('info', 'Redo applied');
    }
  }, [historyIndex, history, showToast]);

  // Keyboard shortcut for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Title change
  const handleTitleChange = (newTitle: string) => {
    updateDocument((prev) => ({
      ...prev,
      title: newTitle,
    }));
    showToast('success', 'Document renamed', newTitle);
  };

  // Safe active page reference
  const safePageIndex = Math.min(
    Math.max(0, activePageIndex),
    Math.max(0, docModel.pages.length - 1)
  );
  const activePage: DocumentPage =
    docModel.pages[safePageIndex] || {
      id: 'fallback-page',
      pageNumber: 1,
      blocks: [],
      rotation: 0,
    };

  // Active block reference
  const activeBlock = activePage.blocks.find((b) => b.id === activeBlockId);

  // Block management
  const handleUpdateBlock = (blockId: string, updates: Partial<DocumentBlock>) => {
    updateDocument((prev) => {
      const newPages = prev.pages.map((p, pIdx) => {
        if (pIdx !== safePageIndex) return p;
        const newBlocks = p.blocks.map((b) => {
          if (b.id !== blockId) return b;
          return { ...b, ...updates };
        });
        return { ...p, blocks: newBlocks };
      });
      return { ...prev, pages: newPages };
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    updateDocument((prev) => {
      const newPages = prev.pages.map((p, pIdx) => {
        if (pIdx !== safePageIndex) return p;
        return {
          ...p,
          blocks: p.blocks.filter((b) => b.id !== blockId),
        };
      });
      return { ...prev, pages: newPages };
    });
    if (activeBlockId === blockId) {
      setActiveBlockId(null);
    }
    showToast('info', 'Block deleted');
  };

  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    updateDocument((prev) => {
      const page = prev.pages[safePageIndex];
      if (!page) return prev;
      const bIdx = page.blocks.findIndex((b) => b.id === blockId);
      if (bIdx === -1) return prev;

      const targetIdx = direction === 'up' ? bIdx - 1 : bIdx + 1;
      if (targetIdx < 0 || targetIdx >= page.blocks.length) return prev;

      const newBlocks = [...page.blocks];
      const temp = newBlocks[bIdx];
      newBlocks[bIdx] = newBlocks[targetIdx];
      newBlocks[targetIdx] = temp;

      const newPages = prev.pages.map((p, pIdx) =>
        pIdx === safePageIndex ? { ...p, blocks: newBlocks } : p
      );
      return { ...prev, pages: newPages };
    });
  };

  const handleDuplicateBlock = (blockId: string) => {
    updateDocument((prev) => {
      const page = prev.pages[safePageIndex];
      if (!page) return prev;
      const bIdx = page.blocks.findIndex((b) => b.id === blockId);
      if (bIdx === -1) return prev;

      const original = page.blocks[bIdx];
      const duplicated: DocumentBlock = {
        ...original,
        id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        content: original.content,
      };

      const newBlocks = [...page.blocks];
      newBlocks.splice(bIdx + 1, 0, duplicated);

      const newPages = prev.pages.map((p, pIdx) =>
        pIdx === safePageIndex ? { ...p, blocks: newBlocks } : p
      );
      return { ...prev, pages: newPages };
    });
    showToast('success', 'Block duplicated');
  };

  const handleAddBlock = (type: BlockType) => {
    const newBlock: DocumentBlock = {
      id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      content:
        type === 'h1'
          ? 'New Heading 1'
          : type === 'h2'
          ? 'New Heading 2'
          : type === 'h3'
          ? 'New Subheading'
          : type === 'bullet'
          ? 'List item detail'
          : type === 'numbered'
          ? 'Numbered step'
          : type === 'callout'
          ? 'Important notice or comment'
          : type === 'signature'
          ? 'Authorized Signer'
          : type === 'table'
          ? 'Data Overview'
          : 'Enter new paragraph text here...',
      align: 'left',
      isBold: type === 'h1' || type === 'h2' || type === 'h3',
      tableData:
        type === 'table'
          ? {
              headers: ['Item Description', 'Category', 'Status', 'Cost'],
              rows: [
                ['System Architecture', 'Core', 'Completed', '$8,500'],
                ['Offline Storage Module', 'Infrastructure', 'In Progress', '$6,200'],
                ['DOCX Export Engine', 'Conversion', 'Ready', '$4,800'],
              ],
            }
          : undefined,
    };

    updateDocument((prev) => {
      const newPages = prev.pages.map((p, pIdx) => {
        if (pIdx !== safePageIndex) return p;
        return {
          ...p,
          blocks: [...p.blocks, newBlock],
        };
      });
      return { ...prev, pages: newPages };
    });

    setActiveBlockId(newBlock.id);
    showToast('info', `Added ${type.toUpperCase()} block`);
  };

  const handleInsertBlockAfter = (afterBlockId: string, type: BlockType) => {
    const newBlock: DocumentBlock = {
      id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      content: type === 'divider' ? '' : 'New paragraph text...',
      align: 'left',
    };

    updateDocument((prev) => {
      const page = prev.pages[safePageIndex];
      if (!page) return prev;

      let newBlocks = [...page.blocks];
      if (!afterBlockId) {
        newBlocks.push(newBlock);
      } else {
        const idx = newBlocks.findIndex((b) => b.id === afterBlockId);
        if (idx !== -1) {
          newBlocks.splice(idx + 1, 0, newBlock);
        } else {
          newBlocks.push(newBlock);
        }
      }

      const newPages = prev.pages.map((p, pIdx) =>
        pIdx === safePageIndex ? { ...p, blocks: newBlocks } : p
      );
      return { ...prev, pages: newPages };
    });

    setActiveBlockId(newBlock.id);
  };

  const handleUpdateActiveBlockStyle = (style: {
    isBold?: boolean;
    isItalic?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
  }) => {
    if (!activeBlockId) {
      showToast('warning', 'Select a block first to apply styling');
      return;
    }
    handleUpdateBlock(activeBlockId, style);
  };

  // Page management
  const handleAddPage = () => {
    const newPageNum = docModel.pages.length + 1;
    const newPage: DocumentPage = {
      id: `page-${Date.now()}`,
      pageNumber: newPageNum,
      rotation: 0,
      blocks: [
        {
          id: `b-${Date.now()}-h2`,
          type: 'h2',
          content: `Section ${newPageNum}`,
          isBold: true,
          align: 'left',
        },
        {
          id: `b-${Date.now()}-p`,
          type: 'paragraph',
          content: 'Add your content, figures, and tables for this page here.',
          align: 'left',
        },
      ],
    };

    updateDocument((prev) => ({
      ...prev,
      pageCount: prev.pages.length + 1,
      pages: [...prev.pages, newPage],
    }));

    setActivePageIndex(docModel.pages.length);
    showToast('success', `Page ${newPageNum} added`);
  };

  const handleDuplicatePage = (index: number) => {
    const targetPage = docModel.pages[index];
    if (!targetPage) return;

    const duplicatedPage: DocumentPage = {
      ...targetPage,
      id: `page-${Date.now()}`,
      pageNumber: index + 2,
      blocks: targetPage.blocks.map((b) => ({
        ...b,
        id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      })),
    };

    const newPages = [...docModel.pages];
    newPages.splice(index + 1, 0, duplicatedPage);
    // Re-index page numbers
    const reindexedPages = newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    updateDocument((prev) => ({
      ...prev,
      pageCount: reindexedPages.length,
      pages: reindexedPages,
    }));

    setActivePageIndex(index + 1);
    showToast('success', `Page ${index + 1} duplicated`);
  };

  const handleDeletePage = (index: number) => {
    if (docModel.pages.length <= 1) {
      showToast('warning', 'Cannot delete the only page in the document');
      return;
    }

    const newPages = docModel.pages
      .filter((_, idx) => idx !== index)
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    updateDocument((prev) => ({
      ...prev,
      pageCount: newPages.length,
      pages: newPages,
    }));

    setActivePageIndex(Math.max(0, index - 1));
    showToast('info', `Page ${index + 1} removed`);
  };

  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= docModel.pages.length) return;

    const newPages = [...docModel.pages];
    const [moved] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, moved);

    const reindexed = newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    updateDocument((prev) => ({
      ...prev,
      pages: reindexed,
    }));

    setActivePageIndex(toIndex);
  };

  const handleRotatePage = (index: number) => {
    updateDocument((prev) => {
      const newPages = prev.pages.map((p, idx) => {
        if (idx !== index) return p;
        const currentRot = p.rotation || 0;
        return { ...p, rotation: (currentRot + 90) % 360 };
      });
      return { ...prev, pages: newPages };
    });
    showToast('info', `Page ${index + 1} rotated 90°`);
  };

  const handleTogglePageLayoutMode = (pageId: string, mode: 'spatial' | 'flow') => {
    updateDocument((prev) => {
      const updatedPages = prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        return { ...p, layoutMode: mode };
      });
      return { ...prev, pages: updatedPages };
    });
    showToast('info', `Switched to ${mode === 'spatial' ? 'High-Fidelity Spatial' : 'Structured Flow'} view`);
  };

  // PDF Import Handling
  const handleFileLoaded = async (file: File) => {
    setIsConverting(true);
    showToast('info', 'Importing PDF...', file.name);
    try {
      const parsedDoc = await parsePdfFile(file);
      updateDocument(parsedDoc);
      setActivePageIndex(0);
      setIsImportModalOpen(false);
      showToast(
        'success',
        'PDF Imported Successfully!',
        `${parsedDoc.pages.length} page(s) reconstructed and ready for editing.`
      );
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to parse PDF', 'Please check that the file is valid.');
    } finally {
      setIsConverting(false);
    }
  };

  // Load sample proposal
  const handleLoadSample = () => {
    updateDocument(SAMPLE_DOCUMENT);
    setActivePageIndex(0);
    setIsImportModalOpen(false);
    showToast(
      'success',
      'Sample Document Loaded',
      'Executive Project Proposal loaded. Try editing text or converting to DOCX!'
    );
  };

  // Blank document
  const handleCreateBlank = () => {
    const blank = createBlankDocument();
    updateDocument(blank);
    setActivePageIndex(0);
    setIsImportModalOpen(false);
    showToast('success', 'Blank Document Created');
  };

  // Quick DOCX Conversion & Download
  const handleQuickConvertDocx = async () => {
    setIsConverting(true);
    try {
      const blob = await exportToDocx(docModel);
      const filename = sanitizeFilename(docModel.title || 'document', 'docx');
      triggerDownload(
        blob,
        filename,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      showToast(
        'success',
        'Word Document (.docx) Exported!',
        `${filename} downloaded to your device.`
      );
    } catch (e) {
      console.error(e);
      showToast('error', 'DOCX Export Error', 'Failed to generate Word document.');
    } finally {
      setIsConverting(false);
    }
  };

  // Direct PDF Preview in new tab
  const handlePreviewPdf = async (pdfOptions?: PdfExportOptions) => {
    setIsConverting(true);
    try {
      const blob = await exportToPdf(docModel, pdfOptions);
      openBlobInNewTab(blob, 'application/pdf');
      showToast(
        'success',
        'PDF Opened in Browser',
        'Document loaded in new tab for direct viewing and printing.'
      );
    } catch (err) {
      console.error(err);
      showToast('error', 'Preview Error', 'Failed to generate PDF for preview.');
    } finally {
      setIsConverting(false);
    }
  };

  // Multi-Format Export Handler
  const handleExportFormat = async (
    format: ExportFormat,
    pdfOptions?: PdfExportOptions
  ) => {
    setIsConverting(true);

    try {
      switch (format) {
        case 'docx': {
          const blob = await exportToDocx(docModel);
          const filename = sanitizeFilename(docModel.title || 'document', 'docx');
          triggerDownload(
            blob,
            filename,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );
          showToast('success', 'Saved as Word Document (.docx)', `${filename} saved.`);
          break;
        }

        case 'pdf': {
          const blob = await exportToPdf(docModel, pdfOptions);
          const filename = sanitizeFilename(docModel.title || 'document', 'pdf');
          triggerDownload(blob, filename, 'application/pdf');
          showToast(
            'success',
            'Saved as PDF (.pdf)',
            `${filename} downloaded. You can also use "Preview in Browser".`
          );
          break;
        }

        case 'html': {
          const htmlContent = exportToHtml(docModel);
          const filename = sanitizeFilename(docModel.title || 'document', 'html');
          triggerDownload(htmlContent, filename, 'text/html;charset=utf-8');
          showToast('success', 'Saved as HTML Webpage (.html)', `${filename} saved.`);
          break;
        }

        case 'markdown': {
          const mdContent = exportToMarkdown(docModel);
          const filename = sanitizeFilename(docModel.title || 'document', 'md');
          triggerDownload(
            mdContent,
            filename,
            'text/markdown;charset=utf-8'
          );
          showToast('success', 'Saved as Markdown (.md)', `${filename} saved.`);
          break;
        }

        case 'txt': {
          const txtContent = exportToPlainText(docModel);
          const filename = sanitizeFilename(docModel.title || 'document', 'txt');
          triggerDownload(txtContent, filename, 'text/plain;charset=utf-8');
          showToast('success', 'Saved as Plain Text (.txt)', `${filename} saved.`);
          break;
        }
      }
    } catch (err) {
      console.error(err);
      showToast('error', `Failed to export as ${format.toUpperCase()}`);
    } finally {
      setIsConverting(false);
    }
  };

  // Open Export Modal with preselected format
  const handleOpenExportWithFormat = (format: ExportFormat) => {
    setExportModalFormat(format);
    setIsExportModalOpen(true);
  };

  return (
    <div id="pdf-converter-app" className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* Navigation Bar */}
      <Navbar
        title={docModel.title}
        onTitleChange={handleTitleChange}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        onOpenUpload={() => setIsImportModalOpen(true)}
        onQuickConvertDocx={() => setIsDocxQuickModalOpen(true)}
        onExportFormat={handleOpenExportWithFormat}
        onLoadSample={handleLoadSample}
        isConverting={isConverting}
      />

      {/* Editor Toolbar */}
      <EditorToolbar
        onAddBlock={handleAddBlock}
        onAddPage={handleAddPage}
        activeBlockType={activeBlock?.type}
        onUpdateActiveBlockStyle={handleUpdateActiveBlockStyle}
        activeAlign={activeBlock?.align || 'left'}
        activeIsBold={activeBlock?.isBold || false}
        activeIsItalic={activeBlock?.isItalic || false}
        onQuickConvertDocx={() => setIsDocxQuickModalOpen(true)}
      />

      {/* Main Workspace: Left Sidebar + Center Document Sheet */}
      <div id="workspace-layout" className="flex-1 flex overflow-hidden">
        {/* Left Thumbnails Sidebar */}
        <PageThumbnails
          document={docModel}
          activePageIndex={safePageIndex}
          onSelectPage={(idx) => {
            setActivePageIndex(idx);
            setActiveBlockId(null);
          }}
          onMovePage={handleMovePage}
          onDuplicatePage={handleDuplicatePage}
          onDeletePage={handleDeletePage}
          onRotatePage={handleRotatePage}
          onAddPage={handleAddPage}
        />

        {/* Center Canvas Stage */}
        <main
          id="editor-canvas-stage"
          className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-200/70 py-8 px-2 sm:px-6 relative flex flex-col items-center"
        >
          {/* Quick Notice Banner on first load */}
          <div className="w-full max-w-[820px] mb-4 bg-white/90 border border-slate-200/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-700 font-medium">
                Editing Page <strong>{safePageIndex + 1}</strong> of{' '}
                <strong>{docModel.pages.length}</strong>
              </span>
              <span className="text-slate-400">• Click any text to edit inline</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDocxQuickModalOpen(true)}
                className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
              >
                Convert to Word (.docx) &rarr;
              </button>
            </div>
          </div>

          {/* Editable Document Page Sheets */}
          <div className="flex flex-col items-center gap-8 w-full">
            {docModel.pages.map((page, idx) => (
              <div
                key={page.id}
                onClick={() => {
                  if (safePageIndex !== idx) {
                    setActivePageIndex(idx);
                  }
                }}
                className="w-full flex flex-col items-center"
              >
                <DocumentPageCanvas
                  page={page}
                  pageIndex={idx}
                  totalPages={docModel.pages.length}
                  zoom={zoom}
                  onUpdateBlock={handleUpdateBlock}
                  onDeleteBlock={handleDeleteBlock}
                  onMoveBlock={handleMoveBlock}
                  onDuplicateBlock={handleDuplicateBlock}
                  onInsertBlockAfter={handleInsertBlockAfter}
                  activeBlockId={activeBlockId}
                  onSetActiveBlockId={setActiveBlockId}
                  onTogglePageLayoutMode={handleTogglePageLayoutMode}
                  isActivePage={safePageIndex === idx}
                />
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Import PDF Drag & Drop Modal */}
      {isImportModalOpen && (
        <div
          id="import-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsImportModalOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
            <Dropzone
              onFileLoaded={handleFileLoaded}
              onLoadSample={handleLoadSample}
              onCreateBlank={handleCreateBlank}
              onClose={() => setIsImportModalOpen(false)}
              isModal={true}
            />
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      <ExportModal
        document={docModel}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportFormat}
        onPreviewPdf={handlePreviewPdf}
        initialFormat={exportModalFormat}
      />

      {/* 1-Click Convert to DOCX Modal */}
      <DocxQuickConverterModal
        document={docModel}
        isOpen={isDocxQuickModalOpen}
        onClose={() => setIsDocxQuickModalOpen(false)}
        onConvertAndDownload={handleQuickConvertDocx}
      />

      {/* Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
