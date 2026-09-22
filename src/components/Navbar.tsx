import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Upload,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Wifi,
  FileCode,
  FileSpreadsheet,
  FileCheck2,
  File,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { ExportFormat } from '../types';

interface NavbarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onOpenUpload: () => void;
  onQuickConvertDocx: () => void;
  onExportFormat: (format: ExportFormat) => void;
  onLoadSample: () => void;
  isConverting?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  onTitleChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomChange,
  onOpenUpload,
  onQuickConvertDocx,
  onExportFormat,
  onLoadSample,
  isConverting = false,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(title);
  }, [title]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onTitleChange(titleInput.trim());
    } else {
      setTitleInput(title);
    }
  };

  return (
    <header
      id="app-header"
      className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 sticky top-0 shadow-xs"
    >
      {/* Left: Brand & Document Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <FileText className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-slate-800 tracking-tight leading-none">
              PDF Converter & Editor
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                Offline Mode Active
              </span>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

        {/* Document Title Editing */}
        <div className="flex items-center">
          {isEditingTitle ? (
            <input
              id="doc-title-input"
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setTitleInput(title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="px-2 py-1 text-sm font-semibold text-slate-800 bg-slate-100 border border-indigo-400 rounded-md outline-hidden max-w-[200px] sm:max-w-xs"
            />
          ) : (
            <button
              id="doc-title-display"
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors text-left max-w-[180px] sm:max-w-xs truncate"
              title="Click to rename document"
            >
              <span className="text-sm font-semibold text-slate-800 truncate">
                {title || 'Untitled Document'}
              </span>
              <span className="text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Edit
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Center: Undo/Redo & Zoom Controls */}
      <div className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/80">
        <button
          id="btn-undo"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:hover:text-slate-300 rounded hover:bg-white transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          id="btn-redo"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:hover:text-slate-300 rounded hover:bg-white transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        <button
          id="btn-zoom-out"
          onClick={() => onZoomChange(Math.max(0.6, Math.round((zoom - 0.1) * 10) / 10))}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-slate-600 px-1.5 min-w-[42px] text-center select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          id="btn-zoom-in"
          onClick={() => onZoomChange(Math.min(1.6, Math.round((zoom + 0.1) * 10) / 10))}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="btn-zoom-reset"
          onClick={() => onZoomChange(1.0)}
          className="px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-white rounded transition-colors"
          title="Reset Zoom to 100%"
        >
          100%
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          id="btn-import-pdf"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 rounded-lg shadow-2xs transition-all"
        >
          <Upload className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Import PDF</span>
        </button>

        {/* Primary Convert to DOCX button */}
        <button
          id="btn-quick-convert-docx"
          onClick={onQuickConvertDocx}
          disabled={isConverting}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm shadow-blue-200 transition-all cursor-pointer disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Convert to DOCX</span>
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="btn-export-dropdown-toggle"
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export As</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportDropdownOpen && (
            <div
              id="export-dropdown-menu"
              className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-xs text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Export Formats
              </div>

              <button
                id="export-opt-docx"
                onClick={() => {
                  setExportDropdownOpen(false);
                  onExportFormat('docx');
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                  DOCX
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Word Document (.docx)</div>
                  <div className="text-[10px] text-slate-400">Microsoft Word & Docs format</div>
                </div>
              </button>

              <button
                id="export-opt-pdf"
                onClick={() => {
                  setExportDropdownOpen(false);
                  onExportFormat('pdf');
                }}
                className="w-full text-left px-3 py-2 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px]">
                  PDF
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Saved PDF Document (.pdf)</div>
                  <div className="text-[10px] text-slate-400">Crisp vector print quality</div>
                </div>
              </button>

              <button
                id="export-opt-html"
                onClick={() => {
                  setExportDropdownOpen(false);
                  onExportFormat('html');
                }}
                className="w-full text-left px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                  HTML
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Web Document (.html)</div>
                  <div className="text-[10px] text-slate-400">Self-contained styled page</div>
                </div>
              </button>

              <button
                id="export-opt-md"
                onClick={() => {
                  setExportDropdownOpen(false);
                  onExportFormat('markdown');
                }}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]">
                  MD
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Markdown (.md)</div>
                  <div className="text-[10px] text-slate-400">GitHub & Obsidian compatible</div>
                </div>
              </button>

              <button
                id="export-opt-txt"
                onClick={() => {
                  setExportDropdownOpen(false);
                  onExportFormat('txt');
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 hover:text-slate-800 flex items-center gap-2.5 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                  TXT
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Plain Text (.txt)</div>
                  <div className="text-[10px] text-slate-400">Unformatted text file</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
