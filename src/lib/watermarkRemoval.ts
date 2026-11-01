import {
  PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFPage, PDFRawStream, PDFRef, PDFStream, PDFString, PDFHexString, decodePDFRawStream,
} from 'pdf-lib';

const toLatin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};
const fromLatin1 = (s: string) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

function decodeStream(doc: PDFDocument, obj: unknown): string | null {
  const s = obj instanceof PDFRef ? doc.context.lookup(obj) : obj;
  if (s instanceof PDFRawStream) {
    try {
      return toLatin1(decodePDFRawStream(s).decode());
    } catch {
      return null;
    }
  }
  if (s instanceof PDFStream) return toLatin1(s.getContents());
  return null;
}

function readContent(doc: PDFDocument, page: PDFPage): string | null {
  const c = page.node.Contents();
  if (!c) return null;
  if (c instanceof PDFArray) {
    const parts: string[] = [];
    for (let i = 0; i < c.size(); i++) {
      const p = decodeStream(doc, c.get(i));
      if (p == null) return null;
      parts.push(p);
    }
    return parts.join('\n');
  }
  return decodeStream(doc, c);
}

// Extract readable text from literal and hex strings inside a chunk of content stream.
function stringsIn(chunk: string) {
  let out = '';
  chunk.replace(/\(((?:\\.|[^\\)])*)\)/g, (_, s: string) => ((out += s.replace(/\\(.)/g, '$1')), ''));
  chunk.replace(/<([0-9a-fA-F\s]+)>/g, (_, h: string) => {
    const hex = h.replace(/\s/g, '');
    for (let i = 0; i + 1 < hex.length; i += 2) {
      const c = parseInt(hex.slice(i, i + 2), 16);
      if (c) out += String.fromCharCode(c);
    }
    return '';
  });
  return out;
}

// Find balanced q…Q (graphics state) blocks and drop the innermost ones that match.
function removeBlocks(content: string, match: (block: string) => boolean) {
  const stack: number[] = [];
  const ranges: [number, number][] = [];
  let depth = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '\\' && depth) { i++; continue; }
    if (ch === '(') { depth++; continue; }
    if (ch === ')' && depth) { depth--; continue; }
    if (depth) continue;
    if ((ch === 'q' || ch === 'Q') && /[\s\]>)]|^$/.test(content[i - 1] ?? '') && /[\s[<(/]|^$/.test(content[i + 1] ?? '')) {
      if (ch === 'q') stack.push(i);
      else if (stack.length) {
        const start = stack.pop()!;
        const end = i + 1;
        const containsRemoved = ranges.some(([a, b]) => a >= start && b <= end);
        if (!containsRemoved && match(content.slice(start, end))) ranges.push([start, end]);
      }
    }
  }
  if (!ranges.length) return { content, count: 0 };
  ranges.sort((a, b) => b[0] - a[0]);
  let out = content;
  for (const [a, b] of ranges) out = out.slice(0, a) + out.slice(b);
  return { content: out, count: ranges.length };
}

function removeTextObjects(content: string, keyword: string) {
  let count = 0;
  const out = content.replace(/\bBT\b[\s\S]*?\bET\b/g, (bt) => {
    if (stringsIn(bt).toLowerCase().includes(keyword)) {
      count++;
      return '';
    }
    return bt;
  });
  return { content: out, count };
}

export type RemoveOpts = { artifacts: boolean; transparent: boolean; annotations: boolean; layers: boolean; keyword: string };

export async function removeWatermarks(bytes: Uint8Array, o: RemoveOpts) {
  const doc = await PDFDocument.load(bytes);
  let removed = 0;
  const kw = o.keyword.trim().toLowerCase();

  const wmLayers = new Set<string>();
  if (o.layers) {
    const ocp = doc.catalog.lookupMaybe(PDFName.of('OCProperties'), PDFDict);
    const ocgs = ocp?.lookupMaybe(PDFName.of('OCGs'), PDFArray);
    for (let i = 0; ocgs && i < ocgs.size(); i++) {
      const ref = ocgs.get(i);
      const d = doc.context.lookup(ref);
      const name = d instanceof PDFDict ? d.lookup(PDFName.of('Name')) : undefined;
      const text = name instanceof PDFString || name instanceof PDFHexString ? name.decodeText() : '';
      if (/watermark|draft|confidential|sample/i.test(text)) wmLayers.add(ref.toString());
    }
  }

  for (const page of doc.getPages()) {
    if (o.annotations) {
      const annots = page.node.Annots();
      if (annots) {
        const keep = PDFArray.withContext(doc.context);
        for (let i = 0; i < annots.size(); i++) {
          const a = doc.context.lookup(annots.get(i));
          const sub = a instanceof PDFDict ? a.get(PDFName.of('Subtype'))?.toString() : '';
          if (sub === '/Watermark') removed++;
          else keep.push(annots.get(i));
        }
        page.node.set(PDFName.of('Annots'), keep);
      }
    }

    let content = readContent(doc, page);
    if (content == null) continue;
    const before = removed;
    const res = page.node.Resources();

    if (o.artifacts) {
      content = content.replace(/\/Artifact\s*<<[^]*?\/Watermark[^]*?>>\s*BDC[\s\S]*?\bEMC\b/g, () => ((removed++), ''));
    }
    if (o.layers && wmLayers.size && res) {
      const props = res.lookupMaybe(PDFName.of('Properties'), PDFDict);
      props?.entries().forEach(([name, val]) => {
        if (wmLayers.has(val.toString())) {
          const re = new RegExp(`/OC\\s*${name.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+BDC[\\s\\S]*?\\bEMC\\b`, 'g');
          content = content!.replace(re, () => ((removed++), ''));
        }
      });
    }
    if (o.transparent && res) {
      const gs = res.lookupMaybe(PDFName.of('ExtGState'), PDFDict);
      const faded: string[] = [];
      gs?.entries().forEach(([name, val]) => {
        const d = doc.context.lookup(val);
        if (!(d instanceof PDFDict)) return;
        const ca = d.lookup(PDFName.of('ca'));
        const CA = d.lookup(PDFName.of('CA'));
        const op = Math.min(ca instanceof PDFNumber ? ca.asNumber() : 1, CA instanceof PDFNumber ? CA.asNumber() : 1);
        if (op < 0.95) faded.push(name.toString());
      });
      if (faded.length) {
        const r = removeBlocks(content, (b) => faded.some((n) => new RegExp(`${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+gs\\b`).test(b)) && /\b(Tj|TJ|Do|f\*?|re)\b/.test(b));
        content = r.content;
        removed += r.count;
      }
    }
    if (kw) {
      const r = removeTextObjects(content, kw);
      content = r.content;
      removed += r.count;
    }
    if (removed !== before) {
      const stream = doc.context.flateStream(fromLatin1(content));
      page.node.set(PDFName.of('Contents'), doc.context.register(stream));
    }
  }
  return { bytes: await doc.save(), removed };
}
