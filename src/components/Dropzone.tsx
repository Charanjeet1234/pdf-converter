import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileCheck,
  ShieldCheck,
  Zap,
  Sparkles,
  PlusCircle,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

interface DropzoneProps {
  onFileLoaded: (file: File) => void;
  onLoadSample: () => void;
  onCreateBlank: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileLoaded,
  onLoadSample,
  onCreateBlank,
  onClose,
  isModal = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setErrorMessage(null);
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please choose a valid .pdf file. Other file types are not supported for PDF import.');
      return;
    }

    setIsLoading(true);
    try {
      onFileLoaded(file);
    } catch (e) {
      console.error(e);
      setErrorMessage('Failed to process PDF. Please try another file.');
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      id="pdf-dropzone-container"
      className={`w-full ${
        isModal
          ? 'max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200'
          : 'max-w-3xl mx-auto my-8 p-6'
      }`}
    >
      {isModal && onClose && (
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Import PDF Document</h2>
              <p className="text-xs text-slate-500">Upload to edit, convert to DOCX, and export</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Drag-and-Drop Area */}
      <div
        id="pdf-dropzone-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
          id="pdf-file-input"
        />

        {isLoading ? (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <div className="text-sm font-semibold text-slate-700">
              Parsing and reconstructing document structure...
            </div>
            <div className="text-xs text-slate-500">
              Extracting text, layout, and rendering page previews client-side
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-md ${
                isDragOver
                  ? 'bg-indigo-600 text-white shadow-indigo-200'
                  : 'bg-white text-indigo-600 shadow-slate-200 border border-slate-100'
              }`}
            >
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Drag & Drop your PDF here
            </h3>
            <p className="text-sm text-slate-500 max-w-md mb-4">
              or <span className="text-indigo-600 font-semibold hover:underline">browse from your device</span> to import and edit
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Standard Adobe PDF (.pdf) • Up to 50MB</span>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Quick Action Shortcuts */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          id="btn-load-sample"
          onClick={onLoadSample}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all text-left group"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="text-slate-800 font-bold">Try Sample Business PDF</div>
            <div className="text-[11px] text-slate-500 font-normal">Test DOCX conversion & edits instantly</div>
          </div>
        </button>

        <button
          id="btn-create-blank"
          onClick={onCreateBlank}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all text-left group"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="text-slate-800 font-bold">New Blank Document</div>
            <div className="text-[11px] text-slate-500 font-normal">Draft and export directly to PDF or DOCX</div>
          </div>
        </button>
      </div>

      {/* Offline Security Guarantee Banner */}
      <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>100% Offline Capable</span>
        </div>
        <div>All conversions happen in your browser — zero file upload to any server</div>
      </div>
    </div>
  );
};
