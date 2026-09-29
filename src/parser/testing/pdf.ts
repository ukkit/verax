// Writes text items as a tiny PDF (raw PDF syntax, no library), so tests can run the real pdf.js path end to end.
// The text uses Helvetica, one of the 14 standard fonts, so nothing is embedded. Test-only.
import type { TextItem } from '../types';

const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

export function buildPdf(items: TextItem[]): Uint8Array {
  const pageCount = Math.max(...items.map((i) => i.page));
  const objects: string[] = [];
  // 1 catalog, 2 pages, 3 font, then a (page, content) pair per page.
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = Array.from({ length: pageCount }, (_, n) => `${4 + n * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let page = 1; page <= pageCount; page++) {
    const content = items
      .filter((i) => i.page === page)
      .map((i) => `BT /F1 8 Tf 1 0 0 1 ${i.x.toFixed(3)} ${i.y.toFixed(3)} Tm (${escape(i.str)}) Tj ET`)
      .join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + (page - 1) * 2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
