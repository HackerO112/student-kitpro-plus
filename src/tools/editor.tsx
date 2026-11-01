import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@project/components/ui/button';
import { MousePointer2, Type, ScanText, Square, Eraser, Highlighter, PenTool, Pipette, ImagePlus, Undo2, Redo2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Loader2, X } from 'lucide-react';
import { FileDrop, Empty, PrivacyNote } from '../components/kit';
import { baseName, download, fileBytes, openPdf, readAsDataUrl, fileToImage } from '../lib/files';
import { isPdf } from '../lib/pdfOps';
import { uid } from '../lib/storage';
import Stage, { type ToolMode } from './editor/Stage';
import Inspector, { ColorField } from './editor/Inspector';
import { CSS_FONT, exportImage, exportPdf, loadImagePage, loadPdfPages, pixelAt, sampleColors, type Obj, type Page, type TextObj } from './editor/model';

type Doc = { name: string; pdf: Uint8Array | null; pages: Page[] };
type Objs = Record<number, Obj[]>;

const TOOLS: { m: ToolMode; icon: typeof Type; label: string; pdfOnly?: boolean }[] = [
  { m: 'select', icon: MousePointer2, label: 'Select & move (V)' },
  { m: 'match', icon: ScanText, label: 'Edit existing text (colour matched)', pdfOnly: true },
  { m: 'text', icon: Type, label: 'Add text (T)' },
  { m: 'whiteout', icon: Eraser, label: 'Whiteout (paper colour)' },
  { m: 'rect', icon: Square, label: 'Rectangle (R)' },
  { m: 'highlight', icon: Highlighter, label: 'Highlight (H)' },
  { m: 'pen', icon: PenTool, label: 'Draw (P)' },
  { m: 'picker', icon: Pipette, label: 'Pick colour from page (I)' },
];

const measureCtx = document.createElement('canvas').getContext('2d')!;
function fitText(o: TextObj): TextObj {
  measureCtx.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${o.size}px ${CSS_FONT[o.font]}`;
  const lines = o.text.split('\n');
  const w = Math.max(o.size * 0.5, ...lines.map((l) => measureCtx.measureText(l).width));
  return { ...o, w, h: lines.length * o.size * 1.2 };
}

function useHistory() {
  const [objs, setObjs] = useState<Objs>({});
  const past = useRef<Objs[]>([]), future = useRef<Objs[]>([]);
  const base = useRef<Objs>({});
  const update = useCallback((next: Objs, commit = true) => {
    setObjs(next);
    if (commit) { past.current.push(base.current); future.current = []; base.current = next; }
  }, []);
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(base.current); base.current = p; setObjs(p); };
  const redo = () => { const f = future.current.pop(); if (!f) return; past.current.push(base.current); base.current = f; setObjs(f); };
  const reset = () => { past.current = []; future.current = []; base.current = {}; setObjs({}); };
  return { objs, update, undo, redo, reset };
}

export function PdfImageEditor() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageIx, setPageIx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<ToolMode>('select');
  const [sel, setSel] = useState<string | null>(null);
  const [color, setColor] = useState('#1a1a1a');
  const [pickTarget, setPickTarget] = useState<string | null>(null);
  const [lastPick, setLastPick] = useState<string | null>(null);
  const h = useHistory();
  const wrap = useRef<HTMLDivElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const page = doc?.pages[pageIx];
  const objs = h.objs[pageIx] ?? [];
  const selObj = objs.find((o) => o.id === sel);

  const setPageObjs = (list: Obj[], commit = true) => h.update({ ...h.objs, [pageIx]: list }, commit);
  const patch = (id: string, p: Partial<Obj>, commit = true) =>
    setPageObjs(objs.map((o) => { if (o.id !== id) return o; const n = { ...o, ...p } as Obj; return n.kind === 'text' ? fitText(n) : n; }), commit);
  const add = (o: Obj) => { setPageObjs([...objs, o]); setSel(o.id); setMode('select'); };

  const fitZoom = (p: Page) => setZoom(Math.min(2, Math.max(0.2, ((wrap.current?.clientWidth ?? 800) - 32) / p.w)));

  const open = async (files: File[]) => {
    const f = files[0];
    setLoading(true);
    try {
      let d: Doc;
      if (isPdf(f)) {
        const bytes = await fileBytes(f);
        d = { name: f.name, pdf: bytes, pages: await loadPdfPages(await openPdf(bytes)) };
      } else d = { name: f.name, pdf: null, pages: [await loadImagePage(await readAsDataUrl(f))] };
      h.reset(); setSel(null); setPageIx(0); setDoc(d); fitZoom(d.pages[0]);
    } catch (e) {
      toast.error(String(e).includes('assword') ? 'This PDF is password-protected. Unlock it first.' : 'Could not open this file.');
    } finally { setLoading(false); }
  };

  const canvasAction = (kind: 'click' | 'box' | 'pen', a: { x: number; y: number; w?: number; h?: number; points?: [number, number][] }) => {
    if (!page) return;
    if (mode === 'picker') {
      const c = pixelAt(page, a.x, a.y);
      setLastPick(c); setColor(c);
      if (pickTarget && selObj) patch(selObj.id, { [pickTarget]: c } as Partial<Obj>);
      setPickTarget(null); setMode('select');
      toast(`Picked ${c}`);
      return;
    }
    const base = { id: uid(), opacity: 1 };
    if (kind === 'click' && mode === 'text') {
      const size = Math.round(page.w / 50);
      add(fitText({ ...base, kind: 'text', x: a.x, y: a.y - size * 0.6, w: 0, h: 0, text: 'Your text', size, color, font: 'sans', bold: false, italic: false }));
    } else if (kind === 'pen' && a.points) {
      const xs = a.points.map((p) => p[0]), ys = a.points.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      add({ ...base, kind: 'pen', x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, points: a.points.map(([px, py]) => [px - x, py - y]), color, width: Math.max(1, page.w / 400) });
    } else if (kind === 'box') {
      const r = { ...base, kind: 'rect' as const, x: a.x, y: a.y, w: a.w!, h: a.h!, strokeW: 0, stroke: color };
      if (mode === 'whiteout') add({ ...r, fill: sampleColors(page, a.x, a.y, a.w!, a.h!).paper });
      else if (mode === 'highlight') add({ ...r, fill: '#ffeb3b', opacity: 0.4 });
      else add({ ...r, fill: 'none', strokeW: Math.max(1, page.w / 400) });
    }
  };

  const matchText = (i: number) => {
    if (!page) return;
    const t = page.texts[i];
    const { ink, paper } = sampleColors(page, t.x, t.y, t.w, t.h);
    const pad = t.size * 0.08;
    const cover: Obj = { id: uid(), kind: 'rect', opacity: 1, x: t.x - pad, y: t.y - pad, w: t.w + pad * 2, h: t.h + pad * 2, fill: paper, stroke: paper, strokeW: 0 };
    const txt = fitText({ id: uid(), kind: 'text', opacity: 1, x: t.x, y: t.y, w: 0, h: 0, text: t.str, size: Number(t.size.toFixed(2)), color: ink, font: t.font, bold: false, italic: false });
    setPageObjs([...objs, cover, txt]); setSel(txt.id); setMode('select');
    toast(`Matched ${t.font} ${t.size.toFixed(1)}pt in ${ink}. Edit the text on the right.`);
  };

  const addImage = async (f?: File) => {
    if (!f || !page) return;
    const src = await readAsDataUrl(f);
    const img = await fileToImage(f);
    const w = Math.min(page.w * 0.4, img.naturalWidth), hh = (w * img.naturalHeight) / img.naturalWidth;
    add({ id: uid(), kind: 'image', opacity: 1, x: (page.w - w) / 2, y: (page.h - hh) / 2, w, h: hh, src });
  };

  const save = async (type?: 'image/png' | 'image/jpeg') => {
    if (!doc) return;
    setBusy(true);
    try {
      if (doc.pdf) download(await exportPdf(doc.pdf, h.objs), `${baseName(doc.name)}-edited.pdf`, 'application/pdf');
      else download(await exportImage(doc.pages[0], h.objs[0] ?? [], type ?? 'image/png'), `${baseName(doc.name)}-edited.${type === 'image/jpeg' ? 'jpg' : 'png'}`);
      toast.success('Downloaded');
    } catch (e) { console.error(e); toast.error('Export failed. Try removing unusual characters from text.'); } finally { setBusy(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) { h.redo(); } else { h.undo(); } return; }
      if (selObj && (e.key === 'Delete' || e.key === 'Backspace')) { setPageObjs(objs.filter((o) => o.id !== selObj.id)); setSel(null); return; }
      const step = e.shiftKey ? 5 : 0.5;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (selObj && d[e.key]) { e.preventDefault(); patch(selObj.id, { x: selObj.x + d[e.key][0], y: selObj.y + d[e.key][1] }); return; }
      const keys: Record<string, ToolMode> = { v: 'select', t: 'text', r: 'rect', h: 'highlight', p: 'pen', i: 'picker' };
      if (!e.metaKey && !e.ctrlKey && keys[e.key]) setMode(keys[e.key]);
      if (e.key === 'Escape') { setSel(null); setMode('select'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!doc) return (
    <div className="space-y-3">
      {loading ? <Empty><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Opening file…</Empty>
        : <FileDrop accept="application/pdf,image/*" multiple={false} onFiles={open} label="Drop a PDF or image to edit" />}
      <PrivacyNote />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-1 rounded-xl border bg-card/95 p-1.5 shadow-sm backdrop-blur">
        {TOOLS.filter((t) => !t.pdfOnly || doc.pdf).map((t) => (
          <Button key={t.m} size="icon" variant={mode === t.m ? 'default' : 'ghost'} className="h-9 w-9" title={t.label} onClick={() => { setMode(t.m); setPickTarget(null); }}>
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Add image or logo" onClick={() => imgInput.current?.click()}><ImagePlus className="h-4 w-4" /></Button>
        <input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="mx-1 h-6 w-px bg-border" />
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Undo (Ctrl+Z)" onClick={h.undo}><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" title="Redo (Ctrl+Shift+Z)" onClick={h.redo}><Redo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}><ZoomOut className="h-4 w-4" /></Button>
        <button className="w-12 text-center font-mono text-xs" onClick={() => page && fitZoom(page)} title="Fit width">{Math.round(zoom * 100)}%</button>
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setZoom((z) => Math.min(6, z * 1.2))}><ZoomIn className="h-4 w-4" /></Button>
        {doc.pages.length > 1 && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-9 w-9" disabled={pageIx === 0} onClick={() => { setPageIx(pageIx - 1); setSel(null); }}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-mono text-xs">{pageIx + 1}/{doc.pages.length}</span>
            <Button size="icon" variant="ghost" className="h-9 w-9" disabled={pageIx === doc.pages.length - 1} onClick={() => { setPageIx(pageIx + 1); setSel(null); }}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDoc(null)}><X className="mr-1 h-4 w-4" />Close</Button>
          {!doc.pdf && <Button size="sm" variant="outline" disabled={busy} onClick={() => save('image/jpeg')}>JPG</Button>}
          <Button size="sm" disabled={busy} onClick={() => save('image/png')}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}{doc.pdf ? 'Download PDF' : 'PNG'}</Button>
        </div>
      </div>
      {mode === 'match' && <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">Click any highlighted text. It's covered with the exact paper colour and replaced by editable text in the same size, font style and sampled ink colour.</p>}
      {mode === 'picker' && <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">Click anywhere on the page to sample that exact pixel colour{pickTarget ? ' for the selected item' : ''}.</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div ref={wrap} className="max-h-[78vh] overflow-auto rounded-xl border bg-muted/60 p-4">
          {page && <Stage page={page} zoom={zoom} mode={mode} objs={objs} selected={sel} onSelect={setSel} onChange={setPageObjs} onCanvasAction={canvasAction} onMatch={matchText} />}
        </div>
        <div className="h-fit space-y-4 rounded-xl border bg-card p-4 shadow-sm lg:sticky lg:top-32">
          {selObj ? (
            <Inspector o={selObj} set={(p) => patch(selObj.id, p)} pick={(f) => { setPickTarget(f); setMode('picker'); }}
              del={() => { setPageObjs(objs.filter((o) => o.id !== selObj.id)); setSel(null); }}
              dup={() => add({ ...selObj, id: uid(), x: selObj.x + 10, y: selObj.y + 10 })}
              order={(d) => { const i = objs.indexOf(selObj), j = i + d; if (j < 0 || j >= objs.length) return; const n = [...objs]; [n[i], n[j]] = [n[j], n[i]]; setPageObjs(n); }} />
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">Current colour</p>
              <ColorField label="New text, shapes & drawings" v={color} on={setColor} onPick={() => { setPickTarget(null); setMode('picker'); }} />
              {lastPick && <p className="text-xs text-muted-foreground">Last picked: <span className="font-mono">{lastPick}</span></p>}
              <p className="text-xs text-muted-foreground">Page size: <span className="font-mono">{page?.w.toFixed(1)} × {page?.h.toFixed(1)}</span> {doc.pdf ? 'pt' : 'px'} · {objs.length} edits on this page</p>
              <p className="text-xs text-muted-foreground">Select an item to edit its exact position, size, colour and opacity.</p>
            </div>
          )}
          <PrivacyNote />
        </div>
      </div>
    </div>
  );
}
