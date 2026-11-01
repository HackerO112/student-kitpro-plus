import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { CSS_FONT, penPath, type Obj, type Page } from './model';

export type ToolMode = 'select' | 'text' | 'match' | 'rect' | 'whiteout' | 'highlight' | 'pen' | 'picker';

type Props = {
  page: Page; zoom: number; mode: ToolMode; objs: Obj[]; selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (objs: Obj[], commit: boolean) => void;
  onCanvasAction: (kind: 'click' | 'box' | 'pen', a: { x: number; y: number; w?: number; h?: number; points?: [number, number][] }) => void;
  onMatch: (i: number) => void;
};

type Drag = { kind: 'move' | 'resize'; id: string; sx: number; sy: number; orig: Obj } | { kind: 'draw'; sx: number; sy: number; pts: [number, number][] };

function BgCanvas({ page }: { page: Page }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    c.width = page.bg.width; c.height = page.bg.height;
    c.getContext('2d')!.drawImage(page.bg, 0, 0);
  }, [page]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

function ObjView({ o, sel }: { o: Obj; sel: boolean }) {
  const ring = sel ? 'outline outline-2 outline-offset-1 outline-primary' : 'hover:outline hover:outline-1 hover:outline-primary/60';
  const st = { left: o.x, top: o.y, opacity: o.opacity } as const;
  if (o.kind === 'pen') return null;
  if (o.kind === 'text') return (
    <div data-id={o.id} className={`absolute cursor-move whitespace-pre ${ring}`} style={{ ...st, fontSize: o.size, lineHeight: 1.2, color: o.color, fontFamily: CSS_FONT[o.font], fontWeight: o.bold ? 700 : 400, fontStyle: o.italic ? 'italic' : 'normal', paddingTop: 0, marginTop: -o.size * 0.1 }}>
      {o.text || ' '}
    </div>
  );
  if (o.kind === 'image') return <img data-id={o.id} src={o.src} draggable={false} className={`absolute cursor-move ${ring}`} style={{ ...st, width: o.w, height: o.h }} />;
  return <div data-id={o.id} className={`absolute cursor-move ${ring}`} style={{ ...st, width: o.w, height: o.h, background: o.fill === 'none' ? 'transparent' : o.fill, border: o.strokeW ? `${o.strokeW}px solid ${o.stroke}` : undefined, boxSizing: 'border-box' }} />;
}

export default function Stage({ page, zoom, mode, objs, selected, onSelect, onChange, onCanvasAction, onMatch }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const pt = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };
  const down = (e: RPE) => {
    const p = pt(e);
    const t = e.target as HTMLElement;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === 'select') {
      const id = t.dataset.handle ?? t.closest<HTMLElement>('[data-id]')?.dataset.id;
      const o = objs.find((x) => x.id === id);
      onSelect(o?.id ?? null);
      if (o) setDrag({ kind: t.dataset.handle ? 'resize' : 'move', id: o.id, sx: p.x, sy: p.y, orig: o });
      return;
    }
    if (mode === 'match') return;
    if (mode === 'text' || mode === 'picker') return onCanvasAction('click', p);
    setDrag({ kind: 'draw', sx: p.x, sy: p.y, pts: [[p.x, p.y]] });
  };
  const move = (e: RPE) => {
    if (!drag) return;
    const p = pt(e);
    if (drag.kind === 'draw') {
      if (mode === 'pen') drag.pts.push([p.x, p.y]);
      setPreview({ x: Math.min(p.x, drag.sx), y: Math.min(p.y, drag.sy), w: Math.abs(p.x - drag.sx), h: Math.abs(p.y - drag.sy) });
      return;
    }
    const dx = p.x - drag.sx, dy = p.y - drag.sy, o = drag.orig;
    let n: Obj;
    if (drag.kind === 'move') n = { ...o, x: o.x + dx, y: o.y + dy };
    else if (o.kind === 'text') { const f = Math.max(0.1, (o.w + dx) / o.w); n = { ...o, size: Math.max(2, o.size * f), w: o.w * f, h: o.h * f }; }
    else if (o.kind === 'pen') { const fx = Math.max(0.05, (o.w + dx) / o.w), fy = Math.max(0.05, (o.h + dy) / o.h); n = { ...o, w: o.w * fx, h: o.h * fy, points: o.points.map(([a, b]) => [a * fx, b * fy]) }; }
    else n = { ...o, w: Math.max(2, o.w + dx), h: Math.max(2, o.h + dy) };
    onChange(objs.map((x) => (x.id === o.id ? n : x)), false);
  };
  const up = () => {
    if (drag?.kind === 'draw') {
      if (mode === 'pen' && drag.pts.length > 1) onCanvasAction('pen', { x: 0, y: 0, points: drag.pts });
      else if (preview && preview.w > 2 && preview.h > 2) onCanvasAction('box', preview);
    } else if (drag) onChange(objs, true);
    setDrag(null); setPreview(null);
  };
  const sel = objs.find((o) => o.id === selected);
  const pens = objs.filter((o) => o.kind === 'pen');
  const cursor = mode === 'select' ? 'default' : mode === 'text' ? 'text' : 'crosshair';
  return (
    <div className="relative mx-auto touch-none select-none shadow-lg" style={{ width: page.w * zoom, height: page.h * zoom, cursor }}
      ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      <BgCanvas page={page} />
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: page.w, height: page.h, transform: `scale(${zoom})` }}>
        {objs.map((o) => <ObjView key={o.id} o={o} sel={o.id === selected} />)}
        <svg className="pointer-events-none absolute inset-0" width={page.w} height={page.h}>
          {pens.map((o) => o.kind === 'pen' && (
            <path key={o.id} d={penPath(o)} stroke={o.color} strokeWidth={o.width} opacity={o.opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {drag?.kind === 'draw' && mode === 'pen' && <path d={drag.pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a} ${b}`).join(' ')} stroke="currentColor" strokeWidth={2 / zoom} fill="none" />}
        </svg>
        {pens.map((o) => <div key={o.id} data-id={o.id} className={`absolute cursor-move ${o.id === selected ? 'outline outline-2 outline-primary' : ''}`} style={{ left: o.x, top: o.y, width: Math.max(o.w, 4), height: Math.max(o.h, 4) }} />)}
        {mode === 'match' && page.texts.map((t, i) => (
          <button key={i} title={t.str} onPointerDown={(e) => { e.stopPropagation(); onMatch(i); }}
            className="absolute rounded-[1px] bg-primary/10 outline outline-1 outline-primary/50 hover:bg-primary/25"
            style={{ left: t.x, top: t.y, width: t.w, height: t.h }} />
        ))}
        {preview && mode !== 'pen' && <div className="absolute border border-dashed border-primary bg-primary/10" style={{ left: preview.x, top: preview.y, width: preview.w, height: preview.h }} />}
        {sel && mode === 'select' && (
          <div data-handle={sel.id} className="absolute cursor-nwse-resize rounded-sm border-2 border-primary bg-background"
            style={{ left: sel.x + (sel.kind === 'text' ? sel.w : sel.w) - 5 / zoom, top: sel.y + sel.h - 5 / zoom, width: 10 / zoom, height: 10 / zoom }} />
        )}
      </div>
    </div>
  );
}
