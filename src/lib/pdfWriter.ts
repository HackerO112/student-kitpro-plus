import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

export const PAGE_SIZES = { A4: [595.28, 841.89], Letter: [612, 792] } as const;
export type PageSize = keyof typeof PAGE_SIZES;

// Standard PDF fonts only support Latin-1; swap anything else so text never fails to encode.
export function safeText(s: string) {
  return s
    .replace(/\t/g, '    ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '?');
}

type FontKey = 'regular' | 'bold' | 'italic' | 'mono' | 'monoBold' | 'serif' | 'serifBold';
type TextOpts = { size?: number; font?: FontKey; align?: 'left' | 'center' | 'right'; gap?: number; indent?: number; color?: [number, number, number] };

export class PdfWriter {
  doc!: PDFDocument;
  page!: PDFPage;
  fonts!: Record<FontKey, PDFFont>;
  y = 0;
  margin = 56;
  w = 0;
  h = 0;

  static async create(size: PageSize = 'A4', margin = 56) {
    const wr = new PdfWriter();
    wr.doc = await PDFDocument.create();
    const e = (f: StandardFonts) => wr.doc.embedFont(f);
    wr.fonts = {
      regular: await e(StandardFonts.Helvetica),
      bold: await e(StandardFonts.HelveticaBold),
      italic: await e(StandardFonts.HelveticaOblique),
      mono: await e(StandardFonts.Courier),
      monoBold: await e(StandardFonts.CourierBold),
      serif: await e(StandardFonts.TimesRoman),
      serifBold: await e(StandardFonts.TimesRomanBold),
    };
    [wr.w, wr.h] = PAGE_SIZES[size];
    wr.margin = margin;
    wr.newPage();
    return wr;
  }

  get contentWidth() {
    return this.w - this.margin * 2;
  }

  newPage() {
    this.page = this.doc.addPage([this.w, this.h]);
    this.y = this.h - this.margin;
  }

  ensure(height: number) {
    if (this.y - height < this.margin) this.newPage();
  }

  gap(h: number) {
    this.y -= h;
  }

  wrap(text: string, font: PDFFont, size: number, maxW: number) {
    const lines: string[] = [];
    safeText(text)
      .split('\n')
      .forEach((para) => {
        if (!para.trim()) return lines.push('');
        let cur = '';
        para.split(/(\s+)/).forEach((word) => {
          const next = cur + word;
          if (font.widthOfTextAtSize(next, size) <= maxW) return (cur = next);
          if (cur.trim()) lines.push(cur.trimEnd());
          // hard-break words longer than a line
          let w = word.trimStart();
          while (font.widthOfTextAtSize(w, size) > maxW) {
            let i = w.length;
            while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > maxW) i--;
            lines.push(w.slice(0, i));
            w = w.slice(i);
          }
          cur = w;
        });
        lines.push(cur.trimEnd());
      });
    return lines;
  }

  text(str: string, o: TextOpts = {}) {
    const size = o.size ?? 11;
    const font = this.fonts[o.font ?? 'regular'];
    const lh = size * (o.gap ?? 1.4);
    const indent = o.indent ?? 0;
    const maxW = this.contentWidth - indent;
    for (const line of this.wrap(str, font, size, maxW)) {
      this.ensure(lh);
      this.y -= lh;
      const tw = font.widthOfTextAtSize(line, size);
      const x =
        o.align === 'center' ? this.margin + (this.contentWidth - tw) / 2 : o.align === 'right' ? this.w - this.margin - tw : this.margin + indent;
      this.page.drawText(line, { x, y: this.y + size * 0.25, size, font, color: rgb(...(o.color ?? [0.1, 0.1, 0.12])) });
    }
  }

  rule(thickness = 0.8) {
    this.ensure(10);
    this.y -= 6;
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.w - this.margin, y: this.y }, thickness, color: rgb(0.6, 0.6, 0.6) });
    this.y -= 6;
  }

  codeBlock(code: string, size = 9, lineNumbers = true) {
    const font = this.fonts.mono;
    const lh = size * 1.45;
    const gutter = lineNumbers ? font.widthOfTextAtSize('0000 ', size) : 0;
    const maxW = this.contentWidth - gutter - 12;
    safeText(code)
      .split('\n')
      .forEach((raw, idx) => {
        const chunks: string[] = [];
        let s = raw;
        do {
          let i = s.length;
          while (i > 1 && font.widthOfTextAtSize(s.slice(0, i), size) > maxW) i--;
          chunks.push(s.slice(0, i));
          s = s.slice(i);
        } while (s.length);
        chunks.forEach((c, ci) => {
          this.ensure(lh);
          this.page.drawRectangle({ x: this.margin, y: this.y - lh, width: this.contentWidth, height: lh, color: rgb(0.965, 0.965, 0.96) });
          this.y -= lh;
          if (lineNumbers && ci === 0)
            this.page.drawText(String(idx + 1).padStart(4, ' '), { x: this.margin + 4, y: this.y + size * 0.35, size, font, color: rgb(0.6, 0.6, 0.6) });
          this.page.drawText(c, { x: this.margin + 6 + gutter, y: this.y + size * 0.35, size, font, color: rgb(0.1, 0.1, 0.15) });
        });
      });
  }

  table(cols: { label: string; width: number }[], rows: string[][], size = 10) {
    const font = this.fonts.regular;
    const bold = this.fonts.bold;
    const widths = cols.map((c) => c.width * this.contentWidth);
    const drawRow = (cells: string[], f: PDFFont, header: boolean) => {
      const wrapped = cells.map((c, i) => this.wrap(c || '', f, size, widths[i] - 8));
      const rowH = Math.max(1, ...wrapped.map((l) => l.length)) * size * 1.35 + 10;
      this.ensure(rowH);
      let x = this.margin;
      wrapped.forEach((lines, i) => {
        this.page.drawRectangle({
          x, y: this.y - rowH, width: widths[i], height: rowH,
          borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 0.7, color: header ? rgb(0.93, 0.93, 0.93) : undefined,
        });
        lines.forEach((ln, li) => this.page.drawText(ln, { x: x + 4, y: this.y - 5 - size - li * size * 1.35 + 2, size, font: f }));
        x += widths[i];
      });
      this.y -= rowH;
    };
    drawRow(cols.map((c) => c.label), bold, true);
    rows.forEach((r) => drawRow(r, font, false));
  }

  async image(bytes: Uint8Array, mime: string, maxW = this.contentWidth, maxH = 400) {
    const img = mime.includes('png') ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
    const s = Math.min(1, maxW / img.width, maxH / img.height);
    const w = img.width * s;
    const h = img.height * s;
    this.ensure(h + 8);
    this.y -= h + 4;
    this.page.drawImage(img, { x: this.margin + (this.contentWidth - w) / 2, y: this.y, width: w, height: h });
    this.y -= 4;
  }

  footer(fn: (n: number, total: number) => string) {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const t = safeText(fn(i + 1, pages.length));
      const tw = this.fonts.regular.widthOfTextAtSize(t, 9);
      p.drawText(t, { x: (this.w - tw) / 2, y: 28, size: 9, font: this.fonts.regular, color: rgb(0.45, 0.45, 0.45) });
    });
  }

  save() {
    return this.doc.save();
  }
}
