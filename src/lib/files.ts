import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = pdfjs.PDFDocumentProxy;

export async function fileBytes(f: Blob) {
  return new Uint8Array(await f.arrayBuffer());
}

export async function openPdf(data: Uint8Array, password?: string): Promise<PdfDoc> {
  return pdfjs.getDocument({ data: data.slice(), password }).promise;
}

export async function renderPage(doc: PdfDoc, n: number, scale: number) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas;
}

export async function renderPageToWidth(doc: PdfDoc, n: number, width: number) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  return renderPage(doc, n, width / base.width);
}

export async function pdfThumb(file: Blob, width = 220) {
  const doc = await openPdf(await fileBytes(file));
  const c = await renderPageToWidth(doc, 1, width);
  return c.toDataURL('image/jpeg', 0.7);
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', q = 0.92): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), type, q));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not read image'));
    img.src = src;
  });
}

export async function fileToImage(f: Blob) {
  const url = URL.createObjectURL(f);
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export function readAsDataUrl(f: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function dataUrlBytes(dataUrl: string) {
  const b = atob(dataUrl.split(',')[1]);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

export function download(data: Blob | Uint8Array | string, name: string, type = 'application/octet-stream') {
  const blob =
    data instanceof Blob ? data : typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadZip(files: { name: string; data: Blob | Uint8Array }[], zipName: string) {
  if (files.length === 1) return download(files[0].data, files[0].name, 'application/pdf');
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.data));
  download(await zip.generateAsync({ type: 'blob' }), zipName);
}

export const baseName = (n: string) => n.replace(/\.[^.]+$/, '');

export function parseRanges(input: string, max: number): number[][] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const [a, b] = part.split('-').map((x) => parseInt(x.trim(), 10));
      const start = Math.max(1, Math.min(max, a || 1));
      const end = Math.max(start, Math.min(max, isNaN(b) ? start : b));
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    });
}
