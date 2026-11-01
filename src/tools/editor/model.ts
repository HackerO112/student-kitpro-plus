import * as pdfjs from 'pdfjs-dist';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { canvasToBlob, loadImage, type PdfDoc } from '../../lib/files';
import { embedImage } from '../../lib/pdfOps';
import { safeText } from '../../lib/pdfWriter';

export type FontFam = 'sans' | 'serif' | 'mono';
type Base = { id: string; x: number; y: number; opacity: number };
export type TextObj = Base & { kind: 'text'; w: number; h: number; text: string; size: number; color: string; font: FontFam; bold: boolean; italic: boolean };
export type RectObj = Base & { kind: 'rect'; w: number; h: number; fill: string; stroke: string; strokeW: number };
export type ImgObj = Base & { kind: 'image'; w: number; h: number; src: string };
export type PenObj = Base & { kind: 'pen'; w: number; h: number; points: [number, number][]; color: string; width: number };
export type Obj = TextObj | RectObj | ImgObj | PenObj;

/** One page: size in units (PDF points, or image pixels) plus a rendered background. */
export type Page = { w: number; h: number; bg: HTMLCanvasElement; scale: number; texts: SourceText[] };
export type SourceText = { str: string; x: number; y: number; w: number; h: number; size: number; font: FontFam };

export const CSS_FONT: Record<FontFam, string> = {
  sans: 'Helvetica, Arial, sans-serif',
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
};
export const ASCENT = 0.8;

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
export function hexRgb(h: string) {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export function pixelAt(page: Page, x: number, y: number) {
  const d = page.bg.getContext('2d')!.getImageData(Math.floor(x * page.scale), Math.floor(y * page.scale), 1, 1).data;
  return hex(d[0], d[1], d[2]);
}

/** Finds the paper colour (most common) and ink colour (most common clearly-different) inside a box. */
export function sampleColors(page: Page, x: number, y: number, w: number, h: number) {
  const s = page.scale;
  const sx = Math.max(0, Math.floor(x * s)), sy = Math.max(0, Math.floor(y * s));
  const sw = Math.max(1, Math.min(page.bg.width - sx, Math.ceil(w * s))), sh = Math.max(1, Math.min(page.bg.height - sy, Math.ceil(h * s)));
  const d = page.bg.getContext('2d')!.getImageData(sx, sy, sw, sh).data;
  const counts = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const unpack = (k: number) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const bg = unpack(sorted[0][0]);
  const dist = (c: number[]) => Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2]);
  // Ink: weigh frequency by contrast so anti-aliased edges don't win over solid glyph pixels.
  let best = bg, score = 0;
  for (const [k, n] of sorted) {
    const c = unpack(k), dd = dist(c);
    if (dd < 60) continue;
    const sc = n * dd * dd;
    if (sc > score) { score = sc; best = c; }
  }
  // Refine ink with exact (unquantised) pixel average near the chosen colour.
  let r = 0, g = 0, b = 0, m = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.hypot(d[i] - best[0], d[i + 1] - best[1], d[i + 2] - best[2]) < 24) { r += d[i]; g += d[i + 1]; b += d[i + 2]; m++; }
  }
  const ink = m ? hex(Math.round(r / m), Math.round(g / m), Math.round(b / m)) : '#000000';
  return { ink, paper: hex(bg[0], bg[1], bg[2]) };
}

export async function loadPdfPages(doc: PdfDoc, renderScale = 2): Promise<Page[]> {
  const pages: Page[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const vp1 = p.getViewport({ scale: 1 });
    const vp = p.getViewport({ scale: renderScale });
    const bg = document.createElement('canvas');
    bg.width = Math.ceil(vp.width);
    bg.height = Math.ceil(vp.height);
    const ctx = bg.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, bg.width, bg.height);
    await p.render({ canvasContext: ctx, viewport: vp }).promise;
    const tc = await p.getTextContent();
    const texts: SourceText[] = [];
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const t = pdfjs.Util.transform(vp1.transform, it.transform);
      const size = Math.hypot(t[2], t[3]);
      const fam = (tc.styles[it.fontName]?.fontFamily ?? '').toLowerCase();
      const font: FontFam = fam.includes('mono') ? 'mono' : fam.includes('serif') && !fam.includes('sans') ? 'serif' : 'sans';
      texts.push({ str: it.str, x: t[4], y: t[5] - size * ASCENT, w: it.width || size * it.str.length * 0.5, h: size * 1.05, size, font });
    }
    pages.push({ w: vp1.width, h: vp1.height, bg, scale: renderScale, texts });
  }
  return pages;
}

export async function loadImagePage(src: string): Promise<Page> {
  const img = await loadImage(src);
  const bg = document.createElement('canvas');
  bg.width = img.naturalWidth;
  bg.height = img.naturalHeight;
  bg.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0);
  return { w: img.naturalWidth, h: img.naturalHeight, bg, scale: 1, texts: [] };
}

export function penPath(o: PenObj, ox = 0, oy = 0) {
  return o.points.map(([px, py], i) => `${i ? 'L' : 'M'}${(o.x + px + ox).toFixed(2)} ${(o.y + py + oy).toFixed(2)}`).join(' ');
}

async function pdfFont(doc: PDFDocument, cache: Map<string, PDFFont>, o: TextObj) {
  const map: Record<FontFam, StandardFonts[]> = {
    sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
    serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
    mono: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
  };
  const name = map[o.font][(o.bold ? 1 : 0) + (o.italic ? 2 : 0)];
  if (!cache.has(name)) cache.set(name, await doc.embedFont(name));
  return cache.get(name)!;
}

async function drawOnPdfPage(doc: PDFDocument, page: PDFPage, objs: Obj[], fonts: Map<string, PDFFont>) {
  const H = page.getHeight();
  const { x: bx, y: by } = page.getCropBox();
  for (const o of objs) {
    const X = bx + o.x, top = by + H - o.y;
    if (o.kind === 'rect') {
      page.drawRectangle({
        x: X, y: top - o.h, width: o.w, height: o.h,
        color: o.fill !== 'none' ? hexRgb(o.fill) : undefined, opacity: o.opacity,
        borderColor: o.strokeW > 0 ? hexRgb(o.stroke) : undefined, borderWidth: o.strokeW, borderOpacity: o.opacity,
      });
    } else if (o.kind === 'text') {
      const font = await pdfFont(doc, fonts, o);
      o.text.split('\n').forEach((line, i) => {
        page.drawText(safeText(line), { x: X, y: top - o.size * ASCENT - i * o.size * 1.2, size: o.size, font, color: hexRgb(o.color), opacity: o.opacity });
      });
    } else if (o.kind === 'image') {
      const img = await embedImage(doc, await (await fetch(o.src)).blob());
      page.drawImage(img, { x: X, y: top - o.h, width: o.w, height: o.h, opacity: o.opacity });
    } else {
      page.drawSvgPath(penPath(o), { x: bx, y: by + H, borderColor: hexRgb(o.color), borderWidth: o.width, borderOpacity: o.opacity, borderLineCap: 1 });
    }
  }
}

export async function exportPdf(bytes: Uint8Array, objs: Record<number, Obj[]>) {
  const doc = await PDFDocument.load(bytes);
  const fonts = new Map<string, PDFFont>();
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) await drawOnPdfPage(doc, pages[i], objs[i] ?? [], fonts);
  return doc.save();
}

export async function exportImage(page: Page, objs: Obj[], type: 'image/png' | 'image/jpeg') {
  const c = document.createElement('canvas');
  c.width = page.w;
  c.height = page.h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(page.bg, 0, 0);
  for (const o of objs) {
    ctx.globalAlpha = o.opacity;
    if (o.kind === 'rect') {
      if (o.fill !== 'none') { ctx.fillStyle = o.fill; ctx.fillRect(o.x, o.y, o.w, o.h); }
      if (o.strokeW > 0) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW; ctx.strokeRect(o.x, o.y, o.w, o.h); }
    } else if (o.kind === 'text') {
      ctx.fillStyle = o.color;
      ctx.textBaseline = 'alphabetic';
      ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${o.size}px ${CSS_FONT[o.font]}`;
      o.text.split('\n').forEach((l, i) => ctx.fillText(l, o.x, o.y + o.size * ASCENT + i * o.size * 1.2));
    } else if (o.kind === 'image') {
      ctx.drawImage(await loadImage(o.src), o.x, o.y, o.w, o.h);
    } else {
      ctx.strokeStyle = o.color; ctx.lineWidth = o.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(penPath(o)));
    }
  }
  return canvasToBlob(c, type, 0.95);
}
