import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Download, Undo2, X } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Slider } from '@project/components/ui/slider';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { ActionButton, Card, Field, FileDrop, PrivacyNote, SegButtons, SideTitle, ToolLayout } from '../components/kit';
import { baseName, canvasToBlob, download, downloadZip, fileToImage } from '../lib/files';
import { uid } from '../lib/storage';

type Fmt = 'image/jpeg' | 'image/png' | 'image/webp';
const EXT: Record<Fmt, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
type ImgItem = { id: string; file: File; url: string };

function useImageList() {
  const [items, setItems] = useState<ImgItem[]>([]);
  const add = (f: File[]) => setItems((l) => [...l, ...f.filter((x) => x.type.startsWith('image/')).map((file) => ({ id: uid(), file, url: URL.createObjectURL(file) }))]);
  return { items, add, remove: (id: string) => setItems((l) => l.filter((i) => i.id !== id)), clear: () => setItems([]) };
}

function ImageGrid({ items, remove, extra }: { items: ImgItem[]; remove: (id: string) => void; extra?: (i: ImgItem) => string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.id} className="relative rounded-lg border bg-card p-2">
          <img src={i.url} alt="" className="checker aspect-square w-full rounded object-contain" />
          <p className="mt-1 truncate text-xs">{i.file.name}</p>
          <p className="text-xs text-muted-foreground">{(i.file.size / 1024).toFixed(0)} KB{extra ? ` → ${extra(i)}` : ''}</p>
          <button onClick={() => remove(i.id)} className="absolute right-1 top-1 rounded-full bg-background p-1 shadow"><X className="h-3 w-3" /></button>
        </div>
      ))}
    </div>
  );
}

async function processImage(file: File, o: { maxW?: number; maxH?: number; fmt: Fmt; quality: number; targetKb?: number }) {
  const img = await fileToImage(file);
  let s = Math.min(1, o.maxW ? o.maxW / img.naturalWidth : 1, o.maxH ? o.maxH / img.naturalHeight : 1);
  const render = async (scale: number, q: number) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d')!;
    if (o.fmt === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return canvasToBlob(c, o.fmt, q);
  };
  let q = o.quality;
  let blob = await render(s, q);
  if (o.targetKb && o.fmt !== 'image/png') {
    for (let i = 0; i < 14 && blob.size / 1024 > o.targetKb; i++) {
      if (q > 0.35) q -= 0.08;
      else s *= 0.85;
      blob = await render(s, q);
    }
  }
  return blob;
}

export function ImageCompressor() {
  const { items, add, remove } = useImageList();
  const [quality, setQuality] = useState(75);
  const [maxW, setMaxW] = useState('');
  const [target, setTarget] = useState('');
  const [fmt, setFmt] = useState<Fmt>('image/jpeg');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const outs: { name: string; data: Blob | Uint8Array }[] = [];
      let before = 0, after = 0;
      for (const i of items) {
        const b = await processImage(i.file, { maxW: Number(maxW) || undefined, fmt, quality: quality / 100, targetKb: Number(target) || undefined });
        before += i.file.size; after += b.size;
        outs.push({ name: `${baseName(i.file.name)}_small.${EXT[fmt]}`, data: b });
      }
      await downloadZip(outs, 'compressed_images.zip');
      toast.success(`${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <ToolLayout
      main={<><FileDrop accept="image/*" onFiles={add} /><ImageGrid items={items} remove={remove} /></>}
      side={
        <>
          <SideTitle>Settings</SideTitle>
          <div className="space-y-4">
            <Field label="Target size (KB)" hint="e.g. 50 for exam portals. Leave blank to use quality."><Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
            <Field label={`Quality ${quality}%`}><Slider value={[quality]} min={10} max={100} step={5} onValueChange={(v) => setQuality(v[0])} /></Field>
            <Field label="Max width (px)"><Input type="number" placeholder="Original" value={maxW} onChange={(e) => setMaxW(e.target.value)} /></Field>
            <Field label="Format"><SegButtons value={fmt} onChange={setFmt} options={[{ value: 'image/jpeg', label: 'JPG' }, { value: 'image/webp', label: 'WEBP' }, { value: 'image/png', label: 'PNG' }]} /></Field>
          </div>
          <ActionButton busy={busy} disabled={!items.length} onClick={run}>Compress & download</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

export function ImageConverter() {
  const { items, add, remove } = useImageList();
  const [fmt, setFmt] = useState<Fmt>('image/png');
  const [busy, setBusy] = useState(false);
  return (
    <ToolLayout
      main={<><FileDrop accept="image/*" onFiles={add} /><ImageGrid items={items} remove={remove} /></>}
      side={
        <>
          <SideTitle>Convert to</SideTitle>
          <SegButtons value={fmt} onChange={setFmt} options={[{ value: 'image/png', label: 'PNG' }, { value: 'image/jpeg', label: 'JPG' }, { value: 'image/webp', label: 'WEBP' }]} />
          <ActionButton busy={busy} disabled={!items.length} onClick={async () => {
            setBusy(true);
            try {
              const outs: { name: string; data: Blob | Uint8Array }[] = [];
              for (const i of items) outs.push({ name: `${baseName(i.file.name)}.${EXT[fmt]}`, data: await processImage(i.file, { fmt, quality: 0.92 }) });
              await downloadZip(outs, 'converted_images.zip');
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>Convert & download</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

// Fill masked pixels by repeatedly averaging known neighbours (simple diffusion inpainting).
function inpaint(ctx: CanvasRenderingContext2D, mask: Uint8Array, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const m = mask.slice();
  let remaining = m.reduce((a, v) => a + v, 0);
  for (let pass = 0; pass < 400 && remaining > 0; pass++) {
    const fill: [number, number, number, number][] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!m[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (m[j]) continue;
            r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++;
          }
        if (n >= 2 || (n && pass > 50)) fill.push([i, r / n, g / n, b / n]);
      }
    for (const [i, r, g, b] of fill) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; m[i] = 0; }
    remaining -= fill.length;
    if (!fill.length) break;
  }
  ctx.putImageData(img, 0, 0);
}

export function ImageWatermarkRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [brush, setBrush] = useState(24);
  const [busy, setBusy] = useState(false);
  const base = useRef<HTMLCanvasElement>(null);
  const maskC = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const drawing = useRef(false);

  useEffect(() => {
    if (!file) return;
    fileToImage(file).then((img) => {
      const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
      [base.current!, maskC.current!].forEach((c) => { c.width = w; c.height = h; });
      base.current!.getContext('2d')!.drawImage(img, 0, 0, w, h);
      history.current = [];
    });
  }, [file]);

  const paint = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = maskC.current!;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.width, y = ((e.clientY - r.top) / r.height) * c.height;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(239,68,68,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, (brush * c.width) / r.width / 2, 0, Math.PI * 2);
    ctx.fill();
  };
  const erase = () => {
    setBusy(true);
    setTimeout(() => {
      const c = base.current!, mc = maskC.current!;
      const ctx = c.getContext('2d')!;
      history.current.push(ctx.getImageData(0, 0, c.width, c.height));
      const md = mc.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const mask = new Uint8Array(c.width * c.height);
      for (let i = 0; i < mask.length; i++) mask[i] = md[i * 4 + 3] > 0 ? 1 : 0;
      inpaint(ctx, mask, c.width, c.height);
      mc.getContext('2d')!.clearRect(0, 0, c.width, c.height);
      setBusy(false);
    }, 30);
  };
  return (
    <ToolLayout
      main={!file ? <FileDrop accept="image/*" multiple={false} onFiles={(f) => setFile(f[0])} /> : (
        <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl border">
          <canvas ref={base} className="block max-h-[70vh] max-w-full" />
          <canvas ref={maskC} className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            onPointerDown={(e) => { drawing.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); paint(e); }}
            onPointerMove={paint} onPointerUp={() => (drawing.current = false)} />
        </div>
      )}
      side={
        <>
          <SideTitle>Brush</SideTitle>
          <p className="mb-3 text-sm text-muted-foreground">Paint over the watermark, then press Erase. Repeat for leftover marks.</p>
          <Field label={`Brush size ${brush}px`}><Slider value={[brush]} min={6} max={80} onValueChange={(v) => setBrush(v[0])} /></Field>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button disabled={!file || busy} onClick={erase}>{busy ? 'Erasing…' : 'Erase marked'}</Button>
            <Button variant="outline" disabled={!file} onClick={() => { const h = history.current.pop(); if (h) base.current!.getContext('2d')!.putImageData(h, 0, 0); maskC.current!.getContext('2d')!.clearRect(0, 0, 9999, 9999); }}><Undo2 className="mr-1 h-4 w-4" />Undo</Button>
          </div>
          {file && <button className="mt-3 text-sm text-primary hover:underline" onClick={() => setFile(null)}>Change image</button>}
          <ActionButton disabled={!file} onClick={async () => download(await canvasToBlob(base.current!, 'image/png'), `${baseName(file!.name)}_clean.png`)}>Download</ActionButton>
          <p className="mt-2 text-xs text-muted-foreground">For use on your own images.</p>
          <PrivacyNote />
        </>
      }
    />
  );
}

export function BackgroundRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [tol, setTol] = useState(40);
  const [out, setOut] = useState<string | null>(null);
  const [bg, setBg] = useState<'transparent' | string>('transparent');
  const process = async () => {
    if (!file) return;
    const img = await fileToImage(file);
    const s = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const { width: w, height: h } = c;
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    const ref = (i: number) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    const seeds = new Map<number, number[]>();
    stack.forEach((i) => seeds.set(i, ref(i)));
    const t2 = tol * tol * 3;
    while (stack.length) {
      const i = stack.pop()!;
      if (seen[i]) continue;
      seen[i] = 1;
      const [r, g, b] = ref(i);
      const sref = seeds.get(i)!;
      if ((r - sref[0]) ** 2 + (g - sref[1]) ** 2 + (b - sref[2]) ** 2 > t2) continue;
      d[i * 4 + 3] = 0;
      const x = i % w, y = (i / w) | 0;
      const push = (j: number) => { if (!seen[j]) { if (!seeds.has(j)) seeds.set(j, sref); stack.push(j); } };
      if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
    }
    // soften the edge
    for (let i = 0; i < w * h; i++) {
      if (d[i * 4 + 3] === 0) continue;
      const x = i % w, y = (i / w) | 0;
      let clear = 0;
      if (x > 0 && d[(i - 1) * 4 + 3] === 0) clear++;
      if (x < w - 1 && d[(i + 1) * 4 + 3] === 0) clear++;
      if (y > 0 && d[(i - w) * 4 + 3] === 0) clear++;
      if (y < h - 1 && d[(i + w) * 4 + 3] === 0) clear++;
      if (clear) d[i * 4 + 3] = 255 - clear * 50;
    }
    ctx.putImageData(data, 0, 0);
    if (bg !== 'transparent') {
      const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
      const x2 = c2.getContext('2d')!; x2.fillStyle = bg; x2.fillRect(0, 0, w, h); x2.drawImage(c, 0, 0);
      return setOut(c2.toDataURL('image/png'));
    }
    setOut(c.toDataURL('image/png'));
  };
  useEffect(() => { process(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [file, tol, bg]);
  return (
    <ToolLayout
      main={!file ? <FileDrop accept="image/*" multiple={false} onFiles={(f) => setFile(f[0])} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <img src={URL.createObjectURL(file)} alt="Original" className="w-full rounded-xl border" />
          {out && <img src={out} alt="Result" className="checker w-full rounded-xl border" />}
        </div>
      )}
      side={
        <>
          <SideTitle>Background</SideTitle>
          <p className="mb-3 text-sm text-muted-foreground">Works best on photos with a plain or evenly lit background, like a wall or sheet of paper.</p>
          <Field label={`Tolerance ${tol}`}><Slider value={[tol]} min={5} max={120} onValueChange={(v) => setTol(v[0])} /></Field>
          <Field label="Replace with">
            <div className="flex gap-2">
              {['transparent', '#ffffff', '#dbeafe', '#fee2e2'].map((c) => (
                <button key={c} onClick={() => setBg(c)} className={`h-8 w-8 rounded-md border-2 ${c === 'transparent' ? 'checker' : ''} ${bg === c ? 'border-primary' : ''}`} style={c !== 'transparent' ? { background: c } : {}} aria-label={c} />
              ))}
            </div>
          </Field>
          {file && <button className="mt-3 text-sm text-primary hover:underline" onClick={() => { setFile(null); setOut(null); }}>Change image</button>}
          <ActionButton disabled={!out} onClick={() => out && fetch(out).then((r) => r.blob()).then((b) => download(b, `${baseName(file!.name)}_nobg.png`))}>Download PNG</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

export function QrCodeGenerator() {
  const [type, setType] = useState<'url' | 'text' | 'wifi'>('url');
  const [text, setText] = useState('https://');
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const [fg, setFg] = useState('#0f172a');
  const [size, setSize] = useState(512);
  const [url, setUrl] = useState('');
  const value = type === 'wifi' ? `WIFI:T:WPA;S:${ssid};P:${pass};;` : text;
  useEffect(() => {
    if (!value.trim()) return setUrl('');
    QRCode.toDataURL(value, { width: size, margin: 2, color: { dark: fg, light: '#ffffff' }, errorCorrectionLevel: 'M' }).then(setUrl).catch(() => setUrl(''));
  }, [value, fg, size]);
  return (
    <ToolLayout
      main={
        <Card className="space-y-4">
          <SegButtons value={type} onChange={setType} options={[{ value: 'url', label: 'Link' }, { value: 'text', label: 'Text' }, { value: 'wifi', label: 'Wi-Fi' }]} />
          {type === 'wifi' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Network name"><Input value={ssid} onChange={(e) => setSsid(e.target.value)} /></Field>
              <Field label="Password"><Input value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
            </div>
          ) : type === 'url' ? <Input value={text} onChange={(e) => setText(e.target.value)} /> : <Textarea value={text} onChange={(e) => setText(e.target.value)} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Color"><Input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-10 p-1" /></Field>
            <Field label="Size">
              <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[256, 512, 1024].map((s) => <SelectItem key={s} value={String(s)}>{s} px</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </Card>
      }
      side={
        <>
          <SideTitle>Preview</SideTitle>
          {url ? <img src={url} alt="QR code" className="mx-auto w-full max-w-[260px] rounded-lg border" /> : <p className="text-sm text-muted-foreground">Enter something to encode.</p>}
          <ActionButton disabled={!url} onClick={() => fetch(url).then((r) => r.blob()).then((b) => download(b, 'qr-code.png'))}><Download className="mr-1 h-4 w-4" />Download PNG</ActionButton>
        </>
      }
    />
  );
}

const PHOTO_SIZES = {
  'in-passport': { label: 'India passport/visa (35×45 mm)', w: 35, h: 45 },
  'us-passport': { label: 'US passport (2×2 in)', w: 51, h: 51 },
  'uk-passport': { label: 'UK/EU passport (35×45 mm)', w: 35, h: 45 },
  'stamp': { label: 'Stamp size (20×25 mm)', w: 20, h: 25 },
  'exam': { label: 'Exam form (3.5×4.5 cm, 300 DPI)', w: 35, h: 45 },
} as const;

export function PassportPhoto() {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [kind, setKind] = useState<keyof typeof PHOTO_SIZES>('in-passport');
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [bg, setBg] = useState('#ffffff');
  const [copies, setCopies] = useState('8');
  const prev = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const sz = PHOTO_SIZES[kind];
  const DPI = 300;
  const pw = Math.round((sz.w / 25.4) * DPI), ph = Math.round((sz.h / 25.4) * DPI);

  useEffect(() => { if (file) fileToImage(file).then(setImg); }, [file]);
  const drawTo = (c: HTMLCanvasElement) => {
    if (!img) return;
    c.width = pw; c.height = ph;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, pw, ph);
    const s = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * zoom;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (pw - w) / 2 + off.x * pw, (ph - h) / 2 + off.y * ph, w, h);
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, pw, ph);
  };
  useEffect(() => { if (prev.current) drawTo(prev.current); });

  const single = async () => { const c = document.createElement('canvas'); drawTo(c); download(await canvasToBlob(c, 'image/jpeg', 0.95), 'passport_photo.jpg'); };
  const sheet = async () => {
    const one = document.createElement('canvas'); drawTo(one);
    const W = 6 * DPI, H = 4 * DPI, gap = 30;
    const cols = Math.floor((W - gap) / (pw + gap)), rows = Math.floor((H - gap) / (ph + gap));
    const n = Math.min(Number(copies) || 1, cols * rows);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < n; k++) ctx.drawImage(one, gap + (k % cols) * (pw + gap), gap + Math.floor(k / cols) * (ph + gap));
    download(await canvasToBlob(c, 'image/jpeg', 0.95), 'passport_sheet_4x6.jpg');
  };
  return (
    <ToolLayout
      main={!file ? <FileDrop accept="image/*" multiple={false} onFiles={(f) => setFile(f[0])} label="Drop a front-facing photo" /> : (
        <Card className="flex flex-col items-center gap-3">
          <canvas ref={prev} className="w-64 cursor-move touch-none rounded shadow-md"
            onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (!drag.current) return; const r = (e.target as HTMLElement).getBoundingClientRect(); setOff((o) => ({ x: o.x + (e.clientX - drag.current!.x) / r.width, y: o.y + (e.clientY - drag.current!.y) / r.height })); drag.current = { x: e.clientX, y: e.clientY }; }}
            onPointerUp={() => (drag.current = null)} />
          <p className="text-xs text-muted-foreground">Drag to position. Keep the face centred, about 70% of the height.</p>
          <button className="text-sm text-primary hover:underline" onClick={() => { setFile(null); setImg(null); }}>Change photo</button>
        </Card>
      )}
      side={
        <>
          <SideTitle>Photo size</SideTitle>
          <div className="space-y-4">
            <Select value={kind} onValueChange={(v) => setKind(v as keyof typeof PHOTO_SIZES)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PHOTO_SIZES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
            <Field label={`Zoom ${zoom.toFixed(2)}×`}><Slider value={[zoom]} min={1} max={3} step={0.02} onValueChange={(v) => setZoom(v[0])} /></Field>
            <Field label="Background fill"><Input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-10 p-1" /></Field>
            <Field label="Copies on 4×6 sheet"><Input type="number" value={copies} onChange={(e) => setCopies(e.target.value)} /></Field>
          </div>
          <ActionButton disabled={!img} onClick={sheet}>Download print sheet</ActionButton>
          <Button variant="outline" className="mt-2 w-full" disabled={!img} onClick={single}>Download single photo</Button>
          <PrivacyNote />
        </>
      }
    />
  );
}
