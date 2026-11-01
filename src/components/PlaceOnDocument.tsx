import { useRef, useState, type ReactNode } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Copy, Plus, RotateCw, Trash2, Maximize2 } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { ActionButton, Empty, FileDrop, PrivacyNote, SideTitle, ToolLayout } from './kit';
import { baseName, canvasToBlob, dataUrlBytes, download, fileBytes, fileToImage, openPdf, readAsDataUrl, renderPageToWidth } from '../lib/files';
import { isPdf, loadPdfLib } from '../lib/pdfOps';
import { uid } from '../lib/storage';

export type Overlay = { png: string; aspect: number };
type Inst = Overlay & { id: string; page: number; x: number; y: number; w: number; rot: number };
type PageImg = { src: string; ratio: number };

function OverlayBox({ inst, selected, onSelect, onChange, box }: { inst: Inst; selected: boolean; onSelect: () => void; onChange: (p: Partial<Inst>) => void; box: () => DOMRect }) {
  const start = (mode: 'move' | 'resize' | 'rotate') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const r = box();
    const sx = e.clientX;
    const sy = e.clientY;
    const { x: ox, y: oy } = inst;
    const move = (ev: PointerEvent) => {
      const cx = r.left + inst.x * r.width;
      const cy = r.top + inst.y * r.height;
      if (mode === 'move') onChange({ x: Math.min(1, Math.max(0, ox + (ev.clientX - sx) / r.width)), y: Math.min(1, Math.max(0, oy + (ev.clientY - sy) / r.height)) });
      if (mode === 'resize') {
        const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        onChange({ w: Math.max(0.04, Math.min(1.2, (2 * d) / Math.sqrt(1 + inst.aspect ** 2) / r.width)) });
      }
      if (mode === 'rotate') onChange({ rot: Math.round((Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div
      onPointerDown={start('move')}
      className={`absolute cursor-move touch-none ${selected ? 'outline outline-2 outline-dashed outline-primary' : 'hover:outline hover:outline-1 hover:outline-primary/50'}`}
      style={{ left: `${inst.x * 100}%`, top: `${inst.y * 100}%`, width: `${inst.w * 100}%`, aspectRatio: `${1 / inst.aspect}`, transform: `translate(-50%,-50%) rotate(${inst.rot}deg)` }}
    >
      <img src={inst.png} alt="" className="pointer-events-none h-full w-full" draggable={false} />
      {selected && (
        <>
          <div onPointerDown={start('resize')} className="absolute -bottom-2.5 -right-2.5 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><Maximize2 className="h-3 w-3" /></div>
          <div onPointerDown={start('rotate')} className="absolute -top-7 left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><RotateCw className="h-3 w-3" /></div>
        </>
      )}
    </div>
  );
}

function cornerFor(cx: number, cy: number, w: number, h: number, rotDeg: number) {
  const t = (-rotDeg * Math.PI) / 180;
  return { x: cx - (Math.cos(t) * w) / 2 + (Math.sin(t) * h) / 2, y: cy - (Math.sin(t) * w) / 2 - (Math.cos(t) * h) / 2, t: -rotDeg };
}

export default function PlaceOnDocument({ overlay, picker, label = 'item' }: { overlay: Overlay | null; picker: ReactNode; label?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageImg[]>([]);
  const [cur, setCur] = useState(0);
  const [insts, setInsts] = useState<Inst[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async (f: File[]) => {
    setBusy(true);
    try {
      const file = f[0];
      if (isPdf(file)) {
        const doc = await openPdf(await fileBytes(file));
        const list: PageImg[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const c = await renderPageToWidth(doc, i, 900);
          list.push({ src: c.toDataURL('image/jpeg', 0.8), ratio: c.height / c.width });
        }
        setPages(list);
      } else {
        const img = await fileToImage(file);
        setPages([{ src: await readAsDataUrl(file), ratio: img.naturalHeight / img.naturalWidth }]);
      }
      setFile(file);
      setInsts([]);
      setCur(0);
    } catch {
      toast.error('Could not open that file. Unlock password-protected PDFs first.');
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!overlay) return toast.error(`Choose a ${label} first`);
    const id = uid();
    setInsts([...insts, { ...overlay, id, page: cur, x: 0.75, y: 0.85, w: 0.25, rot: 0 }]);
    setSel(id);
  };
  const selected = insts.find((i) => i.id === sel);
  const update = (id: string, p: Partial<Inst>) => setInsts((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const copyAll = () => {
    if (!selected) return;
    const extra = pages.map((_, p) => p).filter((p) => p !== selected.page && !insts.some((i) => i.page === p && i.png === selected.png && i.x === selected.x && i.y === selected.y)).map((p) => ({ ...selected, id: uid(), page: p }));
    setInsts([...insts, ...extra]);
    toast.success(`Placed on ${extra.length} more page(s)`);
  };

  const save = async () => {
    if (!file) return;
    setBusy(true);
    try {
      if (isPdf(file)) {
        const doc: PDFDocument = await loadPdfLib(file);
        const cache = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();
        for (const it of insts) {
          if (!cache.has(it.png)) cache.set(it.png, await doc.embedPng(dataUrlBytes(it.png)));
          const page = doc.getPage(it.page);
          const { width: pw, height: ph } = page.getSize();
          const w = it.w * pw;
          const h = w * it.aspect;
          const c = cornerFor(it.x * pw, (1 - it.y) * ph, w, h, it.rot);
          page.drawImage(cache.get(it.png)!, { x: c.x, y: c.y, width: w, height: h, rotate: degrees(c.t) });
        }
        download(await doc.save(), `${baseName(file.name)}_${label}ed.pdf`, 'application/pdf');
      } else {
        const img = await fileToImage(file);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        for (const it of insts) {
          const o = await fileToImage(new Blob([dataUrlBytes(it.png)], { type: 'image/png' }));
          const w = it.w * canvas.width;
          const h = w * it.aspect;
          ctx.save();
          ctx.translate(it.x * canvas.width, it.y * canvas.height);
          ctx.rotate((it.rot * Math.PI) / 180);
          ctx.drawImage(o, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
        const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        download(await canvasToBlob(canvas, type, 0.95), `${baseName(file.name)}_${label}ed.${type === 'image/jpeg' ? 'jpg' : 'png'}`);
      }
      toast.success('Downloaded');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const page = pages[cur];
  return (
    <ToolLayout
      main={
        !file ? (
          busy ? <Empty>Opening file…</Empty> : <FileDrop accept=".pdf,image/*" multiple={false} onFiles={load} label="Drop a PDF or image to place on" />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={add}><Plus className="mr-1 h-4 w-4" />Place {label} here</Button>
              {selected && (
                <>
                  {pages.length > 1 && <Button size="sm" variant="outline" onClick={copyAll}><Copy className="mr-1 h-4 w-4" />Copy to all pages</Button>}
                  <Button size="sm" variant="outline" onClick={() => { setInsts(insts.filter((i) => i.id !== sel)); setSel(null); }}><Trash2 className="mr-1 h-4 w-4" />Remove</Button>
                </>
              )}
              <button className="ml-auto text-sm text-primary hover:underline" onClick={() => { setFile(null); setPages([]); }}>Change file</button>
            </div>
            <div className="checker rounded-xl border p-3 sm:p-6" onPointerDown={() => setSel(null)}>
              <div ref={boxRef} className="relative mx-auto w-full max-w-[720px] select-none overflow-hidden bg-white shadow-lg" style={{ aspectRatio: `${1 / page.ratio}` }}>
                <img src={page.src} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
                {insts.filter((i) => i.page === cur).map((i) => (
                  <OverlayBox key={i.id} inst={i} selected={sel === i.id} onSelect={() => setSel(i.id)} onChange={(p) => update(i.id, p)} box={() => boxRef.current!.getBoundingClientRect()} />
                ))}
              </div>
            </div>
            {pages.length > 1 && (
              <div className="flex items-center justify-center gap-3 text-sm">
                <Button size="icon" variant="outline" disabled={cur === 0} onClick={() => setCur(cur - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                Page {cur + 1} of {pages.length}
                <Button size="icon" variant="outline" disabled={cur === pages.length - 1} onClick={() => setCur(cur + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        )
      }
      side={
        <>
          <SideTitle>Choose {label}</SideTitle>
          {picker}
          <p className="mt-4 text-xs text-muted-foreground">Click "Place {label} here", then drag to move, use the corner to resize and the top handle to rotate.</p>
          <p className="mt-2 text-sm">{insts.length} placed</p>
          <ActionButton busy={busy} disabled={!file || !insts.length} onClick={save}>Apply & download</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}
