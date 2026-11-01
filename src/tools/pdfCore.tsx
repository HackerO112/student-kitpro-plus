import { useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { toast } from 'sonner';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { ActionButton, Field, FileDrop, PrivacyNote, SegButtons, SideTitle, ToolLayout, Empty } from '../components/kit';
import SortableThumbs, { type ThumbItem } from '../components/SortableThumbs';
import { baseName, canvasToBlob, download, downloadZip, fileBytes, openPdf, parseRanges, pdfThumb, renderPage, renderPageToWidth } from '../lib/files';
import { addImagePage, isPdf, loadPdfLib } from '../lib/pdfOps';
import { uid } from '../lib/storage';

type FileItem = ThumbItem & { file: File };

async function toItems(files: File[]): Promise<FileItem[]> {
  return Promise.all(
    files.map(async (file) => ({
      id: uid(),
      name: file.name,
      file,
      thumb: isPdf(file) ? await pdfThumb(file).catch(() => undefined) : URL.createObjectURL(file),
    })),
  );
}

export function MergePdf({ imagesOnly = false }: { imagesOnly?: boolean }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [size, setSize] = useState<'A4' | 'Letter' | 'fit'>('A4');
  const [margin, setMargin] = useState('20');
  const [name, setName] = useState(imagesOnly ? 'images.pdf' : 'merged.pdf');
  const [busy, setBusy] = useState(false);
  const accept = imagesOnly ? 'image/*' : '.pdf,image/*';

  const run = async () => {
    setBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const it of items) {
        if (isPdf(it.file)) {
          const src = await loadPdfLib(it.file);
          (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
        } else await addImagePage(out, it.file, { size, margin: Number(margin) || 0 });
      }
      download(await out.save(), name.endsWith('.pdf') ? name : name + '.pdf', 'application/pdf');
      toast.success('PDF ready');
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
          <FileDrop accept={accept} onFiles={async (f) => setItems([...items, ...(await toItems(f))])} />
          {items.length > 0 && <p className="text-sm text-muted-foreground">Drag to reorder. {items.length} file(s).</p>}
          <SortableThumbs items={items} onChange={setItems} />
        </>
      }
      side={
        <>
          <SideTitle>Settings</SideTitle>
          <div className="space-y-4">
            <Field label="Page size for images">
              <SegButtons value={size} onChange={setSize} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }, { value: 'fit', label: 'Fit image' }]} />
            </Field>
            {size !== 'fit' && (
              <Field label="Margin (pt)">
                <Input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} />
              </Field>
            )}
            <Field label="Output name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <ActionButton busy={busy} disabled={!items.length} onClick={run}>
            {imagesOnly ? 'Convert & download' : 'Merge & download'}
          </ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

export const ImagesToPdf = () => <MergePdf imagesOnly />;

function useSinglePdf() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState(0);
  const pick = async (f: File[]) => {
    try {
      const doc = await openPdf(await fileBytes(f[0]));
      setPages(doc.numPages);
      setFile(f[0]);
    } catch {
      toast.error('Could not open that PDF. If it is password-protected, unlock it first.');
    }
  };
  return { file, pages, pick, reset: () => setFile(null) };
}

export function PdfPicked({ file, pages, onReset }: { file: File; pages: number; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div>
        <p className="font-semibold">{file.name}</p>
        <p className="text-sm text-muted-foreground">
          {pages} pages · {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
      <button className="text-sm text-primary underline-offset-4 hover:underline" onClick={onReset}>
        Change file
      </button>
    </div>
  );
}

export function SplitPdf() {
  const { file, pages, pick, reset } = useSinglePdf();
  const [mode, setMode] = useState<'ranges' | 'each'>('ranges');
  const [ranges, setRanges] = useState('1-2, 3');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const src = await loadPdfLib(file);
      const groups = mode === 'each' ? Array.from({ length: pages }, (_, i) => [i + 1]) : parseRanges(ranges, pages);
      if (!groups.length) throw new Error('Enter at least one page range');
      const outs: { name: string; data: Blob | Uint8Array }[] = [];
      for (const g of groups) {
        const d = await PDFDocument.create();
        (await d.copyPages(src, g.map((n) => n - 1))).forEach((p) => d.addPage(p));
        outs.push({ name: `${baseName(file.name)}_${g[0]}${g.length > 1 ? '-' + g[g.length - 1] : ''}.pdf`, data: await d.save() });
      }
      await downloadZip(outs, `${baseName(file.name)}_split.zip`);
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
          <SideTitle>Split settings</SideTitle>
          <div className="space-y-4">
            <SegButtons value={mode} onChange={setMode} options={[{ value: 'ranges', label: 'Page ranges' }, { value: 'each', label: 'Every page' }]} />
            {mode === 'ranges' && (
              <Field label="Ranges" hint="Each range becomes its own PDF, e.g. 1-3, 5, 8-10">
                <Input value={ranges} onChange={(e) => setRanges(e.target.value)} />
              </Field>
            )}
          </div>
          <ActionButton busy={busy} disabled={!file} onClick={run}>
            Split & download
          </ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

type PageItem = ThumbItem & { index: number };

export function OrganizePdf() {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<PageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File[]) => {
    setBusy(true);
    try {
      const doc = await openPdf(await fileBytes(f[0]));
      const list: PageItem[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const c = await renderPageToWidth(doc, i, 180);
        list.push({ id: uid(), index: i - 1, name: `Page ${i}`, thumb: c.toDataURL('image/jpeg', 0.7), rotation: 0 });
      }
      setItems(list);
      setFile(f[0]);
    } catch {
      toast.error('Could not open that PDF');
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const src = await loadPdfLib(file);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, items.map((i) => i.index));
      copied.forEach((p, k) => {
        p.setRotation(degrees((p.getRotation().angle + (items[k].rotation ?? 0)) % 360));
        out.addPage(p);
      });
      download(await out.save(), `${baseName(file.name)}_organized.pdf`, 'application/pdf');
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
          <>
            <p className="text-sm text-muted-foreground">Drag pages to reorder, use the icons to rotate or delete.</p>
            <SortableThumbs items={items} onChange={setItems} onRotate={(id) => setItems(items.map((i) => (i.id === id ? { ...i, rotation: ((i.rotation ?? 0) + 90) % 360 } : i)))} />
          </>
        ) : busy ? (
          <Empty>Reading pages…</Empty>
        ) : (
          <FileDrop accept=".pdf" multiple={false} onFiles={pick} />
        )
      }
      side={
        <>
          <SideTitle>Pages</SideTitle>
          <p className="text-sm">{items.length} pages in output</p>
          {file && (
            <button className="mt-2 text-sm text-primary hover:underline" onClick={() => { setFile(null); setItems([]); }}>
              Start over
            </button>
          )}
          <ActionButton busy={busy} disabled={!items.length} onClick={run}>
            Save & download
          </ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

export function PdfToImages() {
  const { file, pages, pick, reset } = useSinglePdf();
  const [fmt, setFmt] = useState<'png' | 'jpeg'>('png');
  const [dpi, setDpi] = useState('150');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const doc = await openPdf(await fileBytes(file));
      const outs: { name: string; data: Blob | Uint8Array }[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const c = await renderPage(doc, i, Number(dpi) / 72);
        outs.push({ name: `${baseName(file.name)}_page${i}.${fmt === 'png' ? 'png' : 'jpg'}`, data: await canvasToBlob(c, `image/${fmt}`, 0.9) });
      }
      await downloadZip(outs, `${baseName(file.name)}_images.zip`);
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
          <SideTitle>Export</SideTitle>
          <div className="space-y-4">
            <Field label="Format">
              <SegButtons value={fmt} onChange={setFmt} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }]} />
            </Field>
            <Field label="Quality">
              <Select value={dpi} onValueChange={setDpi}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="96">Screen (96 DPI)</SelectItem>
                  <SelectItem value="150">Standard (150 DPI)</SelectItem>
                  <SelectItem value="300">Print (300 DPI)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <ActionButton busy={busy} disabled={!file} onClick={run}>
            Convert & download
          </ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

export { useSinglePdf };
