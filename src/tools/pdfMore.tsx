import { useState } from 'react';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import { toast } from 'sonner';
import { Input } from '@project/components/ui/input';
import { Slider } from '@project/components/ui/slider';
import { Switch } from '@project/components/ui/switch';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { ActionButton, Field, FileDrop, PrivacyNote, SegButtons, SideTitle, ToolLayout } from '../components/kit';
import { PdfPicked, useSinglePdf } from './pdfCore';
import { baseName, canvasToBlob, download, fileBytes, openPdf, renderPage } from '../lib/files';
import { loadPdfLib } from '../lib/pdfOps';
import { safeText } from '../lib/pdfWriter';
import { removeWatermarks } from '../lib/watermarkRemoval';

const hexToRgb = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

function useRunner() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function SinglePdfTool({ title, children, action, onRun, busy }: { title: string; children: React.ReactNode; action: string; onRun: (f: File) => void; busy: boolean }) {
  const { file, pages, pick, reset } = useSinglePdf();
  return (
    <ToolLayout
      main={file ? <PdfPicked file={file} pages={pages} onReset={reset} /> : <FileDrop accept=".pdf" multiple={false} onFiles={pick} />}
      side={
        <>
          <SideTitle>{title}</SideTitle>
          <div className="space-y-4">{children}</div>
          <ActionButton busy={busy} disabled={!file} onClick={() => file && onRun(file)}>
            {action}
          </ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

export function PageNumbers() {
  const { busy, run } = useRunner();
  const [pos, setPos] = useState('bottom-center');
  const [format, setFormat] = useState('Page {n} of {total}');
  const [start, setStart] = useState('1');
  const [size, setSize] = useState('10');
  const [skipFirst, setSkipFirst] = useState(false);
  return (
    <SinglePdfTool title="Numbering" action="Add numbers & download" busy={busy} onRun={(f) => run(async () => {
      const doc = await loadPdfLib(f);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const fs = Number(size) || 10;
      pages.forEach((p, i) => {
        if (skipFirst && i === 0) return;
        const n = i + (Number(start) || 1) - (skipFirst ? 1 : 0);
        const t = safeText(format.replace('{n}', String(n)).replace('{total}', String(pages.length - (skipFirst ? 1 : 0))));
        const { width, height } = p.getSize();
        const tw = font.widthOfTextAtSize(t, fs);
        const [v, h] = pos.split('-');
        const x = h === 'left' ? 36 : h === 'right' ? width - 36 - tw : (width - tw) / 2;
        const y = v === 'top' ? height - 30 : 22;
        p.drawText(t, { x, y, size: fs, font, color: rgb(0.2, 0.2, 0.2) });
      });
      download(await doc.save(), `${baseName(f.name)}_numbered.pdf`, 'application/pdf');
    })}>
      <Field label="Position">
        <Select value={pos} onValueChange={setPos}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'].map((p) => (
              <SelectItem key={p} value={p}>{p.replace('-', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Format" hint="Use {n} and {total}">
        <Input value={format} onChange={(e) => setFormat(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start at"><Input type="number" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Font size"><Input type="number" value={size} onChange={(e) => setSize(e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-2"><Switch checked={skipFirst} onCheckedChange={setSkipFirst} id="skip" /><Label htmlFor="skip">Skip cover page</Label></div>
    </SinglePdfTool>
  );
}

export function WatermarkPdf() {
  const { busy, run } = useRunner();
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(20);
  const [size, setSize] = useState('60');
  const [color, setColor] = useState('#888888');
  const [layout, setLayout] = useState<'center' | 'tiled'>('center');
  return (
    <SinglePdfTool title="Watermark" action="Apply & download" busy={busy} onRun={(f) => run(async () => {
      const doc = await loadPdfLib(f);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const t = safeText(text);
      const fs = Number(size) || 60;
      doc.getPages().forEach((p) => {
        const { width, height } = p.getSize();
        const tw = font.widthOfTextAtSize(t, fs);
        const draw = (cx: number, cy: number) =>
          p.drawText(t, { x: cx - (tw / 2) * Math.cos(Math.PI / 4), y: cy - (tw / 2) * Math.sin(Math.PI / 4), size: fs, font, color: hexToRgb(color), opacity: opacity / 100, rotate: degrees(45) });
        if (layout === 'center') draw(width / 2, height / 2);
        else for (let y = 0; y < height + tw; y += fs * 4) for (let x = 0; x < width + tw; x += tw + fs * 2) draw(x, y);
      });
      download(await doc.save(), `${baseName(f.name)}_watermarked.pdf`, 'application/pdf');
    })}>
      <Field label="Text"><Input value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <Field label="Layout"><SegButtons value={layout} onChange={setLayout} options={[{ value: 'center', label: 'Diagonal' }, { value: 'tiled', label: 'Tiled' }]} /></Field>
      <Field label={`Opacity ${opacity}%`}><Slider value={[opacity]} min={5} max={100} step={5} onValueChange={(v) => setOpacity(v[0])} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Size"><Input type="number" value={size} onChange={(e) => setSize(e.target.value)} /></Field>
        <Field label="Color"><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" /></Field>
      </div>
    </SinglePdfTool>
  );
}

async function rasterize(src: Uint8Array, scale: number, quality: number, password?: string) {
  const pdf = await openPdf(src, password);
  const out = await PDFDocument.create();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const c = await renderPage(pdf, i, scale);
    const img = await out.embedJpg(await fileBytes(await canvasToBlob(c, 'image/jpeg', quality)));
    out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
  }
  return out.save();
}

const LEVELS = { low: { scale: 2, q: 0.8, label: 'Light (best quality)' }, medium: { scale: 1.5, q: 0.65, label: 'Recommended' }, high: { scale: 1.1, q: 0.5, label: 'Strong (smallest)' } };

export function CompressPdf() {
  const { busy, run } = useRunner();
  const [level, setLevel] = useState<keyof typeof LEVELS>('medium');
  return (
    <SinglePdfTool title="Compression" action="Compress & download" busy={busy} onRun={(f) => run(async () => {
      const bytes = await rasterize(await fileBytes(f), LEVELS[level].scale, LEVELS[level].q);
      if (bytes.length >= f.size) {
        toast.info('This PDF is already well optimised; compressing would make it bigger.');
        return;
      }
      download(bytes, `${baseName(f.name)}_compressed.pdf`, 'application/pdf');
      toast.success(`${(f.size / 1024).toFixed(0)} KB → ${(bytes.length / 1024).toFixed(0)} KB (${Math.round((1 - bytes.length / f.size) * 100)}% smaller)`);
    })}>
      <Field label="Level">
        <div className="space-y-2">
          {(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((k) => (
            <button key={k} onClick={() => setLevel(k)} className={`w-full rounded-lg border p-3 text-left text-sm transition ${level === k ? 'border-primary bg-secondary font-semibold' : ''}`}>
              {LEVELS[k].label}
            </button>
          ))}
        </div>
      </Field>
      <p className="text-xs text-muted-foreground">Pages are re-rendered as images, so text in the result can't be selected.</p>
    </SinglePdfTool>
  );
}

export function UnlockPdf() {
  const { busy, run } = useRunner();
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const go = () => run(async () => {
    if (!file) return;
    try {
      const bytes = await rasterize(await fileBytes(file), 2, 0.9, pw);
      download(bytes, `${baseName(file.name)}_unlocked.pdf`, 'application/pdf');
      toast.success('Unlocked');
    } catch (e) {
      if ((e as Error).name === 'PasswordException') throw new Error('Wrong password');
      throw e;
    }
  });
  return (
    <ToolLayout
      main={file ? <div className="rounded-xl border bg-card p-4 font-semibold">{file.name} <button className="ml-3 text-sm font-normal text-primary" onClick={() => setFile(null)}>Change</button></div> : <FileDrop accept=".pdf" multiple={false} onFiles={(f) => setFile(f[0])} />}
      side={
        <>
          <SideTitle>Password</SideTitle>
          <Field label="Current password" hint="You must know the password; this tool doesn't guess it.">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
          </Field>
          <p className="mt-3 text-xs text-muted-foreground">The unlocked copy is rebuilt from page images.</p>
          <ActionButton busy={busy} disabled={!file} onClick={go}>Unlock & download</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

export function ProtectPdf() {
  const { busy, run } = useRunner();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(false);
  return (
    <SinglePdfTool title="Protection" action="Protect & download" busy={busy} onRun={(f) => run(async () => {
      if (pw.length < 4) throw new Error('Use at least 4 characters');
      if (pw !== pw2) throw new Error("Passwords don't match");
      const clean = await (await loadPdfLib(f)).save({ useObjectStreams: false });
      const out = await encryptPDF(clean, pw, { ownerPassword: pw + '#owner' + Math.random().toString(36).slice(2), allowPrinting: allowPrint, allowCopying: allowCopy, allowModifying: false });
      download(out, `${baseName(f.name)}_protected.pdf`, 'application/pdf');
      toast.success('Protected');
    })}>
      <Field label="Password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <Field label="Confirm password"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
      <div className="flex items-center gap-2"><Switch id="pr" checked={allowPrint} onCheckedChange={setAllowPrint} /><Label htmlFor="pr">Allow printing</Label></div>
      <div className="flex items-center gap-2"><Switch id="cp" checked={allowCopy} onCheckedChange={setAllowCopy} /><Label htmlFor="cp">Allow copying text</Label></div>
    </SinglePdfTool>
  );
}

export function WatermarkRemoverPdf() {
  const { busy, run } = useRunner();
  const [opts, setOpts] = useState({ artifacts: true, layers: true, annotations: true, transparent: false, keyword: '' });
  const toggle = (k: 'artifacts' | 'layers' | 'annotations' | 'transparent', label: string, hint: string) => (
    <div className="flex items-start gap-2">
      <Switch id={k} checked={opts[k]} onCheckedChange={(v) => setOpts({ ...opts, [k]: v })} className="mt-0.5" />
      <div><Label htmlFor={k}>{label}</Label><p className="text-xs text-muted-foreground">{hint}</p></div>
    </div>
  );
  return (
    <SinglePdfTool title="What to remove" action="Remove & download" busy={busy} onRun={(f) => run(async () => {
      const { bytes, removed } = await removeWatermarks(await (await loadPdfLib(f)).save(), opts);
      if (!removed) {
        toast.info('No removable watermark found. Try entering the watermark text, or the "faded overlays" option. Scanned watermarks need the Image Watermark Remover.');
        return;
      }
      download(bytes, `${baseName(f.name)}_clean.pdf`, 'application/pdf');
      toast.success(`Removed ${removed} watermark element(s)`);
    })}>
      {toggle('artifacts', 'Tagged watermarks', 'Added by Word, Acrobat and most PDF tools')}
      {toggle('layers', 'Watermark layers', 'Layers named Watermark, Draft, Sample…')}
      {toggle('annotations', 'Watermark annotations', 'Overlay notes marked as watermarks')}
      {toggle('transparent', 'Faded overlays', 'Semi-transparent text or images drawn over pages')}
      <Field label="Watermark text (optional)" hint="Removes text blocks containing these words">
        <Input placeholder="e.g. DRAFT" value={opts.keyword} onChange={(e) => setOpts({ ...opts, keyword: e.target.value })} />
      </Field>
      <p className="text-xs text-muted-foreground">For use on your own documents.</p>
    </SinglePdfTool>
  );
}
