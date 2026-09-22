import React, { useState } from 'react';
import { ExportFormat, DocumentModel } from '../types';
import { sanitizeFilename } from '../utils/otherExporters';
import {
  Download,
  X,
  FileSpreadsheet,
  FileText,
  FileCode,
  FileCheck2,
  File,
  CheckCircle2,
  Loader2,
  Settings2,
  ExternalLink,
} from 'lucide-react';

interface ExportModalProps {
  document: DocumentModel;
  isOpen: boolean;
  onClose: () => void;
  onExport: (
    format: ExportFormat,
    pdfOptions?: {
      pageSize: 'a4' | 'letter';
      orientation: 'portrait' | 'landscape';
      includePageNumbers: boolean;
    }
  ) => Promise<void>;
  onPreviewPdf?: (pdfOptions: {
    pageSize: 'a4' | 'letter';
    orientation: 'portrait' | 'landscape';
    includePageNumbers: boolean;
  }) => Promise<void>;
  initialFormat?: ExportFormat;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  document,
  isOpen,
  onClose,
  onExport,
  onPreviewPdf,
  initialFormat = 'docx',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(initialFormat);
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      await onExport(selectedFormat, {
        pageSize,
        orientation,
        includePageNumbers,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreview = async () => {
    if (!onPreviewPdf) return;
    setIsPreviewing(true);
    try {
      await onPreviewPdf({
        pageSize,
        orientation,
        includePageNumbers,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const formats: {
    id: ExportFormat;
    label: string;
    ext: string;
    desc: string;
    icon: React.ReactNode;
    badge: string;
    badgeColor: string;
  }[] = [
    {
      id: 'docx',
      label: 'Microsoft Word Document',
      ext: '.docx',
      desc: 'Standard Word format with headings, tables, bullets, and margins',
      icon: <FileSpreadsheet className="w-6 h-6 text-blue-600" />,
      badge: 'Recommended',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      id: 'pdf',
      label: 'Portable Document Format',
      ext: '.pdf',
      desc: 'High-resolution vector PDF ready for printing and sharing',
      icon: <FileText className="w-6 h-6 text-rose-600" />,
      badge: 'Print Ready',
      badgeColor: 'bg-rose-100 text-rose-700',
    },
    {
      id: 'html',
      label: 'Web Page Document',
      ext: '.html',
      desc: 'Self-contained styled HTML file readable in any web browser',
      icon: <FileCode className="w-6 h-6 text-emerald-600" />,
      badge: 'Universal',
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      id: 'markdown',
      label: 'Markdown Document',
      ext: '.md',
      desc: 'Clean markdown syntax for developers, Obsidian, and Notion',
      icon: <FileCheck2 className="w-6 h-6 text-amber-600" />,
      badge: 'Lightweight',
      badgeColor: 'bg-amber-100 text-amber-700',
    },
    {
      id: 'txt',
      label: 'Plain Text File',
      ext: '.txt',
      desc: 'Universal unformatted ASCII/UTF-8 text file',
      icon: <File className="w-6 h-6 text-slate-600" />,
      badge: 'Plain',
      badgeColor: 'bg-slate-100 text-slate-700',
    },
  ];

  return (
    <div
      id="export-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="export-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Export Document</h2>
              <p className="text-xs text-slate-500">
                Choose output format and save your changes locally
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select Output Format
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {formats.map((fmt) => {
                const isSelected = selectedFormat === fmt.id;
                return (
                  <div
                    key={fmt.id}
                    id={`export-option-${fmt.id}`}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                        {fmt.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {fmt.label}
                          </span>
                          <span className="text-xs font-mono font-semibold text-slate-400">
                            {fmt.ext}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fmt.badgeColor}`}
                          >
                            {fmt.badge}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {fmt.desc}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PDF-specific options */}
          {selectedFormat === 'pdf' && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Settings2 className="w-4 h-4 text-slate-500" />
                <span>PDF Formatting Options</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">Page Size</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as 'a4' | 'letter')}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  >
                    <option value="a4">A4 (210 x 297 mm)</option>
                    <option value="letter">US Letter (8.5 x 11 in)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">Orientation</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includePageNumbers}
                  onChange={(e) => setIncludePageNumbers(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Include running headers & page numbers (Page X of Y)</span>
              </label>
            </div>
          )}

          {/* Document Summary Info */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Target filename:{' '}
              <strong className="text-slate-800 font-mono">
                {sanitizeFilename(
                  document.title,
                  selectedFormat === 'markdown' ? 'md' : selectedFormat
                )}
              </strong>
            </span>
            <span>{document.pages.length} page(s)</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {selectedFormat === 'pdf' && onPreviewPdf && (
              <button
                id="btn-preview-pdf-browser"
                type="button"
                onClick={handlePreview}
                disabled={isPreviewing || isExporting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Open and preview the generated PDF directly in a new browser tab"
              >
                {isPreviewing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>Preview in Browser</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-export"
              onClick={handleDownload}
              disabled={isExporting || isPreviewing}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm shadow-indigo-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating {selectedFormat.toUpperCase()}...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download {selectedFormat.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
