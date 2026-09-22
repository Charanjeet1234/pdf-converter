import { DocumentModel } from '../types';
import { SAMPLE_DOCUMENT } from './sampleData';

const STORAGE_KEY = 'pdf_converter_active_document';

export function saveDocumentToStorage(doc: DocumentModel): boolean {
  try {
    // Avoid saving large blobs in localStorage by removing originalPdfBlob
    const serializableDoc: DocumentModel = {
      ...doc,
      originalPdfBlob: undefined,
      lastModified: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableDoc));
    return true;
  } catch (err) {
    console.warn('Could not save to localStorage:', err);
    return false;
  }
}

export function loadDocumentFromStorage(): DocumentModel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.id === 'sample-project-proposal') {
      return SAMPLE_DOCUMENT;
    }
    return parsed;
  } catch (err) {
    console.warn('Could not load from localStorage:', err);
    return null;
  }
}

export function clearDocumentStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn(e);
  }
}

export function createBlankDocument(title = 'Untitled Document'): DocumentModel {
  return {
    id: `doc-${Date.now()}`,
    title,
    sourceType: 'created_blank',
    pageCount: 1,
    lastModified: Date.now(),
    pages: [
      {
        id: `page-1-${Date.now()}`,
        pageNumber: 1,
        rotation: 0,
        blocks: [
          {
            id: `b-${Date.now()}-1`,
            type: 'h1',
            content: title,
            isBold: true,
            align: 'left',
          },
          {
            id: `b-${Date.now()}-2`,
            type: 'paragraph',
            content: 'Start drafting your document content here. You can add sections, headings, bullet lists, and tables using the top toolbar.',
            align: 'left',
          },
        ],
      },
    ],
  };
}
