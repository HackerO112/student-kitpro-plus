import { useEffect, useRef, useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { SegButtons } from './kit';

export function trimCanvas(src: HTMLCanvasElement, pad = 8) {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < x0) return null;
  const w = x1 - x0 + pad * 2;
  const h = y1 - y0 + pad * 2;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(src, x0 - pad, y0 - pad, w, h, 0, 0, w, h);
  return out;
}

const TYPE_FONTS = [
  { label: 'Classic', css: "italic 400 80px 'Brush Script MT', 'Segoe Script', cursive" },
  { label: 'Elegant', css: "italic 400 72px 'Lucida Handwriting', 'Segoe Script', cursive" },
  { label: 'Neat', css: "italic 600 64px Georgia, 'Times New Roman', serif" },
];

export default function SignaturePad({ onDone, doneLabel = 'Use signature' }: { onDone: (s: { png: string; aspect: number }) => void; doneLabel?: string }) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [color, setColor] = useState('#0f2a6b');
  const [width, setWidth] = useState(4);
  const [text, setText] = useState('');
  const [fontIdx, setFontIdx] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const clear = () => ref.current!.getContext('2d')!.clearRect(0, 0, 1200, 400);

  useEffect(() => {
    if (mode !== 'type') return;
    const ctx = ref.current!.getContext('2d')!;
    clear();
    ctx.fillStyle = color;
    ctx.font = TYPE_FONTS[fontIdx].css;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 600, 200);
  }, [mode, text, fontIdx, color]);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1200, y: ((e.clientY - r.top) / r.height) * 400 };
  };
  const down = (e: React.PointerEvent) => {
    if (mode !== 'draw') return;
    drawing.current = true;
    last.current = pos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const moveP = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const ctx = ref.current!.getContext('2d')!;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const done = () => {
    const t = trimCanvas(ref.current!);
    if (!t) return;
    onDone({ png: t.toDataURL('image/png'), aspect: t.height / t.width });
    clear();
    setText('');
  };

  return (
    <div className="space-y-3">
      <SegButtons value={mode} onChange={(m) => { clear(); setMode(m); }} options={[{ value: 'draw', label: 'Draw' }, { value: 'type', label: 'Type' }]} />
      <canvas
        ref={ref}
        width={1200}
        height={400}
        onPointerDown={down}
        onPointerMove={moveP}
        onPointerUp={() => (drawing.current = false)}
        className="checker aspect-[3/1] w-full touch-none rounded-lg border"
      />
      {mode === 'type' && (
        <>
          <Input placeholder="Type your name" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            {TYPE_FONTS.map((f, i) => (
              <Button key={f.label} size="sm" variant={i === fontIdx ? 'default' : 'outline'} onClick={() => setFontIdx(i)}>{f.label}</Button>
            ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {['#0f2a6b', '#111111', '#1d4ed8', '#b91c1c'].map((c) => (
          <button key={c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`} style={{ background: c }} aria-label={c} />
        ))}
        {mode === 'draw' && <input type="range" min={1} max={10} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-24 accent-[hsl(var(--primary))]" />}
        <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
        <Button size="sm" className="ml-auto" onClick={done}>{doneLabel}</Button>
      </div>
    </div>
  );
}
