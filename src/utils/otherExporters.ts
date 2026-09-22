import { DocumentModel } from '../types';

export function exportToPlainText(docModel: DocumentModel): string {
  let output = `${docModel.title.toUpperCase()}\n`;
  output += '='.repeat(docModel.title.length) + '\n\n';

  docModel.pages.forEach((page, pageIdx) => {
    if (docModel.pages.length > 1) {
      output += `--- Page ${pageIdx + 1} ---\n\n`;
    }

    page.blocks.forEach((block) => {
      switch (block.type) {
        case 'h1':
          output += `${block.content.toUpperCase()}\n${'='.repeat(block.content.length)}\n\n`;
          break;
        case 'h2':
          output += `${block.content}\n${'-'.repeat(block.content.length)}\n\n`;
          break;
        case 'h3':
          output += `### ${block.content}\n\n`;
          break;
        case 'bullet':
          output += `• ${block.content}\n`;
          break;
        case 'numbered':
          output += `1. ${block.content}\n`;
          break;
        case 'callout':
          output += `[NOTE] ${block.content}\n\n`;
          break;
        case 'divider':
          output += `----------------------------------------\n\n`;
          break;
        case 'signature':
          output += `\nSignature: __________________\n${block.content}\n\n`;
          break;
        case 'table':
          if (block.tableData) {
            output += `TABLE: ${block.content || ''}\n`;
            output += block.tableData.headers.join('\t|\t') + '\n';
            output += '-'.repeat(40) + '\n';
            block.tableData.rows.forEach((row) => {
              output += row.join('\t|\t') + '\n';
            });
            output += '\n';
          }
          break;
        case 'paragraph':
        default:
          output += `${block.content}\n\n`;
          break;
      }
    });
  });

  return output;
}

export function exportToMarkdown(docModel: DocumentModel): string {
  let md = `# ${docModel.title}\n\n`;

  docModel.pages.forEach((page, pageIdx) => {
    if (docModel.pages.length > 1) {
      md += `<!-- Page ${pageIdx + 1} -->\n\n`;
    }

    page.blocks.forEach((block) => {
      switch (block.type) {
        case 'h1':
          md += `# ${block.content}\n\n`;
          break;
        case 'h2':
          md += `## ${block.content}\n\n`;
          break;
        case 'h3':
          md += `### ${block.content}\n\n`;
          break;
        case 'bullet':
          md += `* ${block.content}\n`;
          break;
        case 'numbered':
          md += `1. ${block.content}\n`;
          break;
        case 'callout':
          md += `> **Note:** ${block.content}\n\n`;
          break;
        case 'divider':
          md += `---\n\n`;
          break;
        case 'signature':
          md += `\n**Authorized Signature:**\n\n*${block.content}*\n\n`;
          break;
        case 'table':
          if (block.tableData && block.tableData.headers.length > 0) {
            md += `| ${block.tableData.headers.join(' | ')} |\n`;
            md += `| ${block.tableData.headers.map(() => '---').join(' | ')} |\n`;
            block.tableData.rows.forEach((row) => {
              md += `| ${row.join(' | ')} |\n`;
            });
            md += '\n';
          }
          break;
        case 'paragraph':
        default:
          md += `${block.content}\n\n`;
          break;
      }
    });
  });

  return md;
}

export function exportToHtml(docModel: DocumentModel): string {
  let bodyContent = '';

  docModel.pages.forEach((page, pageIdx) => {
    bodyContent += `<section class="page" id="page-${pageIdx + 1}">\n`;
    bodyContent += `  <div class="page-number">Page ${pageIdx + 1} of ${docModel.pages.length}</div>\n`;

    page.blocks.forEach((block) => {
      const align = block.align ? `text-align: ${block.align};` : '';
      switch (block.type) {
        case 'h1':
          bodyContent += `  <h1 style="${align}">${escapeHtml(block.content)}</h1>\n`;
          break;
        case 'h2':
          bodyContent += `  <h2 style="${align}">${escapeHtml(block.content)}</h2>\n`;
          break;
        case 'h3':
          bodyContent += `  <h3 style="${align}">${escapeHtml(block.content)}</h3>\n`;
          break;
        case 'bullet':
          bodyContent += `  <ul><li>${escapeHtml(block.content)}</li></ul>\n`;
          break;
        case 'numbered':
          bodyContent += `  <ol><li>${escapeHtml(block.content)}</li></ol>\n`;
          break;
        case 'callout':
          bodyContent += `  <div class="callout">${escapeHtml(block.content)}</div>\n`;
          break;
        case 'divider':
          bodyContent += `  <hr />\n`;
          break;
        case 'signature':
          bodyContent += `  <div class="signature"><div class="line"></div><strong>${escapeHtml(block.content)}</strong></div>\n`;
          break;
        case 'table':
          if (block.tableData) {
            bodyContent += `  <table><thead><tr>`;
            block.tableData.headers.forEach((h) => (bodyContent += `<th>${escapeHtml(h)}</th>`));
            bodyContent += `</tr></thead><tbody>`;
            block.tableData.rows.forEach((r) => {
              bodyContent += `<tr>`;
              r.forEach((c) => (bodyContent += `<td>${escapeHtml(c)}</td>`));
              bodyContent += `</tr>`;
            });
            bodyContent += `</tbody></table>\n`;
          }
          break;
        case 'paragraph':
        default:
          bodyContent += `  <p style="${align}">${escapeHtml(block.content)}</p>\n`;
          break;
      }
    });

    bodyContent += `</section>\n`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(docModel.title)}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      margin: 0;
      padding: 40px 20px;
    }
    .page {
      max-width: 800px;
      margin: 0 auto 30px auto;
      background: #ffffff;
      padding: 60px 70px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      position: relative;
    }
    .page-number {
      font-size: 12px;
      color: #94a3b8;
      text-align: right;
      margin-bottom: 20px;
    }
    h1 { font-size: 28px; color: #0f172a; margin-top: 0; line-height: 1.2; }
    h2 { font-size: 20px; color: #1e293b; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    h3 { font-size: 16px; color: #334155; margin-top: 18px; }
    p { font-size: 15px; line-height: 1.6; color: #334155; margin: 12px 0; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { font-size: 14.5px; line-height: 1.5; color: #334155; margin-bottom: 4px; }
    .callout {
      background: #eef2ff;
      border-left: 4px solid #4f46e5;
      padding: 12px 16px;
      margin: 16px 0;
      color: #3730a3;
      font-size: 14px;
      border-radius: 0 6px 6px 0;
    }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; }
    th { background: #3b82f6; color: #ffffff; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    .signature { text-align: right; margin-top: 40px; }
    .signature .line { display: inline-block; width: 220px; border-top: 1px solid #94a3b8; margin-bottom: 8px; }
    @media print {
      body { background: transparent; padding: 0; }
      .page { box-shadow: none; margin: 0; padding: 20mm; page-break-after: always; }
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeFilename(name: string, targetExt?: string): string {
  let clean = (name || 'document').trim();
  // Remove existing known extensions from name
  clean = clean.replace(/\.(pdf|docx|xlsx|html|htm|txt|md|markdown)$/i, '');
  // Replace invalid filename characters: \ / : * ? " < > |
  clean = clean.replace(/[\\/:*?"<>|]/g, '_').trim();
  if (!clean) clean = 'document';
  if (targetExt) {
    const ext = targetExt.startsWith('.') ? targetExt.substring(1) : targetExt;
    return `${clean}.${ext}`;
  }
  return clean;
}

export function triggerDownload(
  blobOrText: Blob | string,
  rawFilename: string,
  mimeType?: string
) {
  let blob: Blob;
  if (typeof blobOrText === 'string') {
    blob = new Blob([blobOrText], { type: mimeType || 'text/plain;charset=utf-8' });
  } else if (blobOrText instanceof Blob) {
    // Ensure blob has explicit mimeType
    if (mimeType && (!blobOrText.type || blobOrText.type !== mimeType)) {
      blob = new Blob([blobOrText], { type: mimeType });
    } else {
      blob = blobOrText;
    }
  } else {
    blob = new Blob([blobOrText], { type: mimeType || 'application/octet-stream' });
  }

  const filename = sanitizeFilename(rawFilename);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Keep Object URL valid for 2 minutes so downloads complete safely even on slower disks/mobile
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  }, 120000);
}

export function openBlobInNewTab(blob: Blob, mimeType = 'application/pdf') {
  const typedBlob = new Blob([blob], { type: mimeType });
  const url = URL.createObjectURL(typedBlob);
  const newTab = window.open(url, '_blank');
  if (!newTab) {
    // If popup blocked, create anchor and click
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  }, 180000);
}
