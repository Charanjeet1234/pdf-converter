import React from 'react';
import { DocumentModel } from '../types';
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  RotateCw,
  Plus,
  Layers,
  FileText,
} from 'lucide-react';

interface PageThumbnailsProps {
  document: DocumentModel;
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onRotatePage: (index: number) => void;
  onAddPage: () => void;
}

export const PageThumbnails: React.FC<PageThumbnailsProps> = ({
  document,
  activePageIndex,
  onSelectPage,
  onMovePage,
  onDuplicatePage,
  onDeletePage,
  onRotatePage,
  onAddPage,
}) => {
  return (
    <aside
      id="page-thumbnails-sidebar"
      className="w-64 bg-slate-50/90 border-r border-slate-200 flex flex-col shrink-0 select-none overflow-hidden h-[calc(100vh-64px)]"
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white/60">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800">
            Pages ({document.pages.length})
          </span>
        </div>
        <button
          id="sidebar-add-page"
          onClick={onAddPage}
          className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
          title="Add New Page"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {document.pages.map((page, index) => {
          const isActive = index === activePageIndex;
          const rotation = page.rotation || 0;

          return (
            <div
              key={page.id}
              id={`thumbnail-page-${index + 1}`}
              onClick={() => onSelectPage(index)}
              className={`group relative rounded-xl border-2 transition-all p-2 bg-white cursor-pointer ${
                isActive
                  ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Header inside thumbnail: Page Number & Actions */}
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span
                  className={`text-[11px] font-bold ${
                    isActive ? 'text-indigo-700' : 'text-slate-500'
                  }`}
                >
                  Page {index + 1}
                </span>

                {/* Page Quick Actions */}
                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (index > 0) onMovePage(index, index - 1);
                    }}
                    disabled={index === 0}
                    className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded"
                    title="Move Page Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (index < document.pages.length - 1) onMovePage(index, index + 1);
                    }}
                    disabled={index === document.pages.length - 1}
                    className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded"
                    title="Move Page Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicatePage(index);
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                    title="Duplicate Page"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotatePage(index);
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                    title="Rotate Page 90°"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  {document.pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(index);
                      }}
                      className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                      title="Delete Page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Thumbnail Visual Sheet */}
              <div
                className="w-full aspect-[1/1.35] bg-white rounded-md border border-slate-200 overflow-hidden relative shadow-2xs transition-transform flex flex-col p-2 select-none"
                style={{
                  transform: rotation ? `rotate(${rotation}deg)` : undefined,
                }}
              >
                {page.thumbnailUrl ? (
                  <img
                    src={page.thumbnailUrl}
                    alt={`Page ${index + 1}`}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col justify-start gap-1 overflow-hidden pointer-events-none">
                    {page.blocks.slice(0, 7).map((b, bIdx) => {
                      if (b.type === 'h1') {
                        return (
                          <div
                            key={bIdx}
                            className="h-2 w-4/5 bg-slate-800 rounded-xs mb-1"
                          />
                        );
                      }
                      if (b.type === 'h2' || b.type === 'h3') {
                        return (
                          <div
                            key={bIdx}
                            className="h-1.5 w-3/5 bg-slate-600 rounded-xs mb-0.5"
                          />
                        );
                      }
                      if (b.type === 'table') {
                        return (
                          <div
                            key={bIdx}
                            className="h-4 w-full border border-blue-200 bg-blue-50/50 rounded-xs my-0.5"
                          />
                        );
                      }
                      if (b.type === 'callout') {
                        return (
                          <div
                            key={bIdx}
                            className="h-3 w-full border-l-2 border-indigo-500 bg-indigo-50/50 rounded-xs my-0.5"
                          />
                        );
                      }
                      return (
                        <div
                          key={bIdx}
                          className="h-1 w-full bg-slate-200 rounded-xs"
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Page Button */}
        <button
          id="btn-sidebar-add-page-footer"
          onClick={onAddPage}
          className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Blank Page</span>
        </button>
      </div>
    </aside>
  );
};
