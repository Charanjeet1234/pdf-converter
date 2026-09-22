import React, { useState } from 'react';
import { DocumentModel } from '../types';
import {
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  Loader2,
  FileCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface DocxQuickConverterModalProps {
  document: DocumentModel;
  isOpen: boolean;
  onClose: () => void;
  onConvertAndDownload: () => Promise<void>;
}

export const DocxQuickConverterModal: React.FC<DocxQuickConverterModalProps> = ({
  document,
  isOpen,
  onClose,
  onConvertAndDownload,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  // Calculate statistics
  let totalHeadings = 0;
  let totalParagraphs = 0;
  let totalTables = 0;
  let totalLists = 0;

  document.pages.forEach((p) => {
    p.blocks.forEach((b) => {
      if (b.type === 'h1' || b.type === 'h2' || b.type === 'h3') totalHeadings++;
      if (b.type === 'paragraph') totalParagraphs++;
      if (b.type === 'table') totalTables++;
      if (b.type === 'bullet' || b.type === 'numbered') totalLists++;
    });
  });

  const handleConvert = async () => {
    setIsProcessing(true);
    try {
      await onConvertAndDownload();
      setIsDone(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="docx-converter-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="docx-converter-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                Convert PDF to Microsoft Word (.docx)
              </h2>
              <p className="text-xs text-blue-100">
                Direct client-side conversion • Preserves full structure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="font-semibold text-slate-700">Source Document:</span>
            <span className="text-slate-900 font-bold truncate max-w-[240px]">
              {document.title}
            </span>
          </div>

          {/* Reconstructed Structure Stats */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Document Elements Reconstructed
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl">
                <div className="text-base font-extrabold text-blue-700">
                  {document.pages.length}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">Pages</div>
              </div>
              <div className="p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                <div className="text-base font-extrabold text-indigo-700">
                  {totalHeadings}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">Headings</div>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-base font-extrabold text-slate-700">
                  {totalParagraphs + totalLists}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">Text & Lists</div>
              </div>
              <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <div className="text-base font-extrabold text-emerald-700">
                  {totalTables}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">Data Tables</div>
              </div>
            </div>
          </div>

          {/* Benefits bullets */}
          <div className="space-y-2 text-xs text-slate-600 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% editable in MS Word, Google Docs, and LibreOffice</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Reconstructs native Word headings, paragraphs, and tables</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Offline execution — no cloud upload required</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Output: <strong className="text-slate-800">{document.title}.docx</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200"
            >
              Close
            </button>
            <button
              id="btn-trigger-docx-download"
              onClick={handleConvert}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm shadow-blue-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Converting...</span>
                </>
              ) : isDone ? (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Again</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Convert & Download DOCX</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
