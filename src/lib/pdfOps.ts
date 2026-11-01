import { PDFDocument } from 'pdf-lib';
import { canvasToBlob, fileBytes, fileToImage } from './files';
import { PAGE_SIZES } from './pdfWriter';

export async function embedImage(doc: PDFDocument, file: Blob) {
  if (file.type === 'image/jpeg') return doc.embedJpg(await fileBytes(file));
  if (file.type === 'image/png') return doc.embedPng(await fileBytes(file));
  const img = await fileToImage(file);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return doc.embedPng(await fileBytes(await canvasToBlob(c)));
}

export type ImagePageOpts = { size: 'A4' | 'Letter' | 'fit'; margin: number; landscape?: boolean };

export async function addImagePage(doc: PDFDocument, file: Blob, o: ImagePageOpts) {
  const img = await embedImage(doc, file);
  if (o.size === 'fit') {
    const p = doc.addPage([img.width, img.height]);
    p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    return;
  }
  let [w, h]: number[] = [...PAGE_SIZES[o.size]];
  if (o.landscape ?? img.width > img.height) [w, h] = [h, w];
  const p = doc.addPage([w, h]);
  const s = Math.min((w - o.margin * 2) / img.width, (h - o.margin * 2) / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  p.drawImage(img, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
}

export async function loadPdfLib(file: Blob) {
  try {
    return await PDFDocument.load(await fileBytes(file));
  } catch (e) {
    if (String(e).toLowerCase().includes('encrypt')) throw new Error('This PDF is password-protected. Unlock it first with Unlock PDF.');
    throw new Error('Could not read this PDF. It may be damaged.');
  }
}

export const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
