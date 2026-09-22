import React from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Minus,
  Table as TableIcon,
  PenTool,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Plus,
  FilePlus,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { BlockType } from '../types';

interface EditorToolbarProps {
  onAddBlock: (type: BlockType) => void;
  onAddPage: () => void;
  activeBlockType?: BlockType;
  onUpdateActiveBlockStyle?: (style: {
    isBold?: boolean;
    isItalic?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
  }) => void;
  activeAlign?: 'left' | 'center' | 'right' | 'justify';
  activeIsBold?: boolean;
  activeIsItalic?: boolean;
  onQuickConvertDocx: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onAddBlock,
  onAddPage,
  onUpdateActiveBlockStyle,
  activeAlign = 'left',
  activeIsBold = false,
  activeIsItalic = false,
  onQuickConvertDocx,
}) => {
  return (
    <div
      id="editor-toolbar"
      className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs z-20 text-xs"
    >
      {/* Left: Element Inserters */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 select-none">
          Insert
        </span>

        <button
          id="insert-h1"
          onClick={() => onAddBlock('h1')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 transition-colors"
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">H1</span>
        </button>

        <button
          id="insert-h2"
          onClick={() => onAddBlock('h2')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 transition-colors"
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">H2</span>
        </button>

        <button
          id="insert-h3"
          onClick={() => onAddBlock('h3')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 transition-colors"
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">H3</span>
        </button>

        <button
          id="insert-paragraph"
          onClick={() => onAddBlock('paragraph')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
          title="Paragraph Text"
        >
          <Pilcrow className="w-4 h-4 text-slate-600" />
          <span className="hidden sm:inline">Text</span>
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1"></div>

        <button
          id="insert-bullet"
          onClick={() => onAddBlock('bullet')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
          title="Bullet List"
        >
          <List className="w-4 h-4 text-slate-600" />
          <span className="hidden md:inline">Bullet</span>
        </button>

        <button
          id="insert-numbered"
          onClick={() => onAddBlock('numbered')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4 text-slate-600" />
          <span className="hidden md:inline">Numbered</span>
        </button>

        <button
          id="insert-table"
          onClick={() => onAddBlock('table')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
          title="Insert Table"
        >
          <TableIcon className="w-4 h-4 text-blue-600" />
          <span className="hidden md:inline">Table</span>
        </button>

        <button
          id="insert-callout"
          onClick={() => onAddBlock('callout')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
          title="Callout Box"
        >
          <Quote className="w-4 h-4 text-purple-600" />
          <span className="hidden lg:inline">Callout</span>
        </button>

        <button
          id="insert-divider"
          onClick={() => onAddBlock('divider')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
          title="Divider Line"
        >
          <Minus className="w-4 h-4 text-slate-500" />
          <span className="hidden lg:inline">Line</span>
        </button>

        <button
          id="insert-signature"
          onClick={() => onAddBlock('signature')}
          className="p-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors"
          title="Sign-off / Signature"
        >
          <PenTool className="w-4 h-4 text-slate-700" />
          <span className="hidden lg:inline">Sign</span>
        </button>
      </div>

      {/* Middle: Formatting Controls */}
      <div className="flex items-center gap-1 bg-slate-100/70 p-0.5 rounded-lg border border-slate-200">
        <button
          id="format-bold"
          onClick={() =>
            onUpdateActiveBlockStyle &&
            onUpdateActiveBlockStyle({ isBold: !activeIsBold })
          }
          className={`p-1.5 rounded transition-colors ${
            activeIsBold ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Toggle Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          id="format-italic"
          onClick={() =>
            onUpdateActiveBlockStyle &&
            onUpdateActiveBlockStyle({ isItalic: !activeIsItalic })
          }
          className={`p-1.5 rounded transition-colors ${
            activeIsItalic ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Toggle Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <div className="h-3.5 w-px bg-slate-300 mx-0.5"></div>

        <button
          id="align-left"
          onClick={() =>
            onUpdateActiveBlockStyle &&
            onUpdateActiveBlockStyle({ align: 'left' })
          }
          className={`p-1.5 rounded transition-colors ${
            activeAlign === 'left' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>

        <button
          id="align-center"
          onClick={() =>
            onUpdateActiveBlockStyle &&
            onUpdateActiveBlockStyle({ align: 'center' })
          }
          className={`p-1.5 rounded transition-colors ${
            activeAlign === 'center' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>

        <button
          id="align-right"
          onClick={() =>
            onUpdateActiveBlockStyle &&
            onUpdateActiveBlockStyle({ align: 'right' })
          }
          className={`p-1.5 rounded transition-colors ${
            activeAlign === 'right' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <button
          id="align-justify"
          onClick={() =>
            onUpdateActiveBlockStyle &&
            onUpdateActiveBlockStyle({ align: 'justify' })
          }
          className={`p-1.5 rounded transition-colors ${
            activeAlign === 'justify' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Justify"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Page Management & Convert Shortcut */}
      <div className="flex items-center gap-2">
        <button
          id="btn-add-page"
          onClick={onAddPage}
          className="flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-semibold transition-colors"
          title="Add a new page to document"
        >
          <FilePlus className="w-3.5 h-3.5 text-indigo-600" />
          <span>New Page</span>
        </button>
      </div>
    </div>
  );
};
