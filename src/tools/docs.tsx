import { useState } from 'react';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, PageBreak } from 'docx';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { ActionButton, Field, FileDrop, PrivacyNote, SegButtons, SideTitle, ToolLayout } from '../components/kit';
import { PdfPicked, useSinglePdf } from './pdfCore';
import { baseName, dataUrlBytes, download, fileBytes, openPdf, type PdfDoc } from '../lib/files';
import { PdfWriter, type PageSize } from '../lib/pdfWriter';

type Line = { text: string; size: number; y: number };

async function pageLines(doc: PdfDoc, n: number): Promise<Line[]> {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  const rows = new Map<number, { x: number; str: string; size: number }[]>();
  for (const it of tc.items) {
    if (!('str' in it) || !it.str) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    const size = Math.abs(it.transform[3]) || 10;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push({ x: it.transform[4], str: it.str, size });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, parts]) => {
      parts.sort((a, b) => a.x - b.x);
      return { y, text: parts.map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim(), size: Math.max(...parts.map((p) => p.size)) };
    })
    .filter((l) => l.text);
}

export async function extractText(file: File) {
  const doc = await openPdf(await fileBytes(file));
  const pages: Line[][] = [];
  for (let i = 1; i <= doc.numPages; i++) pages.push(await pageLines(doc, i));
  return pages;
}

export function PdfToText() {
  const { file, pages, pick, reset } = useSinglePdf();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const all = await extractText(file);
      const t = all.map((p, i) => `--- Page ${i + 1} ---\n` + p.map((l) => l.text).join('\n')).join('\n\n');
      if (!all.some((p) => p.length)) toast.info('No text found. This looks like a scanned PDF (images only).');
      setText(t);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolLayout
      main={
        <>
          {file ? <PdfPicked file={file} pages={pages} onReset={() => { reset(); setText(''); }} /> : <FileDrop accept=".pdf" multiple={false} onFiles={pick} />}
          {text && <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[420px] font-mono text-xs" />}
        </>
      }
      side={
        <>
          <SideTitle>Extract</SideTitle>
          <ActionButton busy={busy} disabled={!file} onClick={run}>Extract text</ActionButton>
          {text && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(text); toast.success('Copied'); }}><Copy className="mr-1 h-4 w-4" />Copy</Button>
              <Button variant="outline" onClick={() => download(text, `${baseName(file!.name)}.txt`)}>.txt</Button>
            </div>
          )}
          <PrivacyNote />
        </>
      }
    />
  );
}

export function PdfToWord() {
  const { file, pages, pick, reset } = useSinglePdf();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const all = await extractText(file);
      if (!all.some((p) => p.length)) throw new Error('No text found. Scanned PDFs (images only) cannot be converted to editable text.');
      const sizes = all.flat().map((l) => l.size).sort((a, b) => a - b);
      const body = sizes[Math.floor(sizes.length / 2)] || 11;
      const children: Paragraph[] = [];
      all.forEach((lines, pi) => {
        let para: string[] = [];
        let paraSize = body;
        let lastY: number | null = null;
        const flush = () => {
          if (!para.length) return;
          const heading = paraSize > body * 1.25;
          children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: para.join(' '), bold: heading, size: Math.round(Math.min(paraSize, 28) * 2) })] }));
          para = [];
        };
        lines.forEach((l) => {
          const gapBig = lastY != null && lastY - l.y > l.size * 1.9;
          const sizeChange = Math.abs(l.size - paraSize) > 1.5;
          if (gapBig || sizeChange) flush();
          if (!para.length) paraSize = l.size;
          para.push(l.text);
          lastY = l.y;
        });
        flush();
        if (pi < all.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
      });
      const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
      download(blob, `${baseName(file.name)}.docx`);
      toast.success('Word file ready');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolLayout
      main={file ? <PdfPicked file={file} pages={pages} onReset={reset} /> : <FileDrop accept=".pdf" multiple={false} onFiles={pick} />}
      side={
        <>
          <SideTitle>Convert</SideTitle>
          <p className="text-sm text-muted-foreground">Keeps text, paragraphs, headings and page breaks. Complex layouts, tables and images are simplified.</p>
          <ActionButton busy={busy} disabled={!file} onClick={run}>Convert to Word</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

async function htmlToPdf(html: string, size: PageSize) {
  const wr = await PdfWriter.create(size, 60);
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild!;
  const walk = async (el: Element, listIdx?: { n: number; ordered: boolean }) => {
    for (const node of Array.from(el.children)) {
      const tag = node.tagName.toLowerCase();
      const txt = (node.textContent ?? '').trim();
      if (tag === 'h1') { wr.gap(6); wr.text(txt, { size: 20, font: 'bold' }); wr.gap(4); }
      else if (tag === 'h2') { wr.gap(6); wr.text(txt, { size: 16, font: 'bold' }); wr.gap(3); }
      else if (/^h[3-6]$/.test(tag)) { wr.gap(4); wr.text(txt, { size: 13, font: 'bold' }); }
      else if (tag === 'ul' || tag === 'ol') await walk(node, { n: 0, ordered: tag === 'ol' });
      else if (tag === 'li' && listIdx) { listIdx.n++; wr.text(`${listIdx.ordered ? listIdx.n + '.' : '-'} ${txt}`, { indent: 14 }); }
      else if (tag === 'table') {
        const rows = Array.from(node.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((c) => (c.textContent ?? '').trim()));
        if (rows.length) { const n = Math.max(...rows.map((r) => r.length)); wr.gap(4); wr.table(Array.from({ length: n }, (_, i) => ({ label: rows[0][i] ?? '', width: 1 / n })), rows.slice(1).map((r) => Array.from({ length: n }, (_, i) => r[i] ?? '')), 9); wr.gap(6); }
      } else if (tag === 'p') {
        for (const img of Array.from(node.querySelectorAll('img'))) {
          const src = img.getAttribute('src') ?? '';
          if (/^data:image\/(png|jpe?g)/.test(src)) await wr.image(dataUrlBytes(src), src.slice(5, src.indexOf(';')), wr.contentWidth, 380).catch(() => undefined);
        }
        if (txt) { const strong = node.querySelector('strong') && node.querySelector('strong')!.textContent!.trim() === txt; wr.text(txt, { font: strong ? 'bold' : 'regular' }); wr.gap(5); }
      } else if (txt) { wr.text(txt); wr.gap(5); }
    }
  };
  await walk(root);
  return wr.save();
}

export function WordToPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [html, setHtml] = useState('');
  const [size, setSize] = useState<PageSize>('A4');
  const [busy, setBusy] = useState(false);
  const pick = async (f: File[]) => {
    try {
      const res = await mammoth.convertToHtml({ arrayBuffer: await f[0].arrayBuffer() });
      setHtml(res.value);
      setFile(f[0]);
    } catch {
      toast.error('Could not read that file. Only .docx files are supported (not old .doc).');
    }
  };
  const run = async () => {
    setBusy(true);
    try {
      download(await htmlToPdf(html, size), `${baseName(file!.name)}.pdf`, 'application/pdf');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolLayout
      main={
        file ? (
          <div className="rounded-xl border bg-white p-8 text-black shadow-sm">
            <div className="mb-3 flex justify-between text-sm"><b>{file.name}</b><button className="text-primary" onClick={() => setFile(null)}>Change file</button></div>
            <div className="prose prose-sm max-h-[520px] max-w-none overflow-auto" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : (
          <FileDrop accept=".docx" multiple={false} onFiles={pick} />
        )
      }
      side={
        <>
          <SideTitle>Convert</SideTitle>
          <Field label="Page size"><SegButtons value={size} onChange={setSize} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }]} /></Field>
          <p className="mt-3 text-xs text-muted-foreground">Keeps headings, paragraphs, lists, tables and images. Custom fonts and colours are simplified.</p>
          <ActionButton busy={busy} disabled={!file} onClick={run}>Convert & download</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}
