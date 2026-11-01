import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Slider } from '@project/components/ui/slider';
import { Switch } from '@project/components/ui/switch';
import { Label } from '@project/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import { Field, SegButtons, Card } from '../components/kit';
import PlaceOnDocument, { type Overlay } from '../components/PlaceOnDocument';
import SignaturePad from '../components/SignaturePad';
import { STAMP_PRESETS, renderStampSvg, stampToPng, type StampConfig } from '../lib/stamp';
import { useStored, uid } from '../lib/storage';
import { dataUrlBytes, download, fileToImage } from '../lib/files';

export function useStamps() {
  return useStored<StampConfig[]>('stamps', []);
}
export type SavedSig = { id: string; png: string; aspect: number };
export function useSignatures() {
  return useStored<SavedSig[]>('signatures', []);
}

function StampSvg({ c, className }: { c: StampConfig; className?: string }) {
  const svg = useMemo(() => renderStampSvg(c), [c]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="width:100%;height:100%" ') }} />;
}

const COLORS = ['#1d4ed8', '#15803d', '#b91c1c', '#7c2d12', '#6d28d9', '#111827'];

function StampEditor({ c, onChange }: { c: StampConfig; onChange: (p: Partial<StampConfig>) => void }) {
  const uploadLogo = async (f?: File) => {
    if (!f) return;
    const img = await fileToImage(f);
    const s = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth * s;
    cv.height = img.naturalHeight * s;
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    onChange({ logo: cv.toDataURL('image/png'), icon: 'logo' });
  };
  const curved = c.shape === 'round' || c.shape === 'oval';
  return (
    <div className="space-y-4">
      <Field label="Name"><Input value={c.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
      <Field label="Shape">
        <Select value={c.shape} onValueChange={(v) => onChange({ shape: v as StampConfig['shape'] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="round">Round seal</SelectItem>
            <SelectItem value="oval">Oval</SelectItem>
            <SelectItem value="rect">Rectangle</SelectItem>
            <SelectItem value="badge">Rounded badge</SelectItem>
            <SelectItem value="signature">Signature style</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={curved ? 'Top curved text' : 'Top line'}><Input value={c.topText} onChange={(e) => onChange({ topText: e.target.value })} /></Field>
      <Field label={curved ? 'Bottom curved text' : 'Bottom line'}><Input value={c.bottomText} onChange={(e) => onChange({ bottomText: e.target.value })} /></Field>
      <Field label={c.shape === 'signature' ? 'Signature name' : 'Center text'}><Input value={c.centerText} onChange={(e) => onChange({ centerText: e.target.value })} /></Field>
      <Field label="Small text"><Input value={c.subText} onChange={(e) => onChange({ subText: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Center icon">
          <Select value={c.icon} onValueChange={(v) => onChange({ icon: v as StampConfig['icon'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="star">Star</SelectItem>
              <SelectItem value="check">Tick</SelectItem>
              <SelectItem value="cross">Cross</SelectItem>
              <SelectItem value="logo">Logo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Logo">
          <Input type="file" accept="image/*" className="text-xs" onChange={(e) => uploadLogo(e.target.files?.[0])} />
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Switch id="dt" checked={c.showDate} onCheckedChange={(v) => onChange({ showDate: v })} /><Label htmlFor="dt">Today's date</Label></div>
        {c.showDate && (
          <Select value={c.dateFormat} onValueChange={(v) => onChange({ dateFormat: v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dd MMM yyyy">31 Oct 2026</SelectItem>
              <SelectItem value="dd/MM/yyyy">31/10/2026</SelectItem>
              <SelectItem value="MM/dd/yyyy">10/31/2026</SelectItem>
              <SelectItem value="yyyy-MM-dd">2026-10-31</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <Field label="Ink color">
        <div className="flex items-center gap-2">
          {COLORS.map((col) => (
            <button key={col} onClick={() => onChange({ color: col })} className={`h-7 w-7 rounded-full border-2 ${c.color === col ? 'border-foreground' : 'border-transparent'}`} style={{ background: col }} aria-label={col} />
          ))}
          <Input type="color" value={c.color} onChange={(e) => onChange({ color: e.target.value })} className="h-8 w-12 p-1" />
        </div>
      </Field>
      <Field label="Border"><SegButtons value={c.border} onChange={(v) => onChange({ border: v })} options={[{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }, { value: 'dashed', label: 'Dashed' }, { value: 'none', label: 'None' }]} /></Field>
      <Field label="Font">
        <SegButtons value={c.font} onChange={(v) => onChange({ font: v })} options={[{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }, { value: 'script', label: 'Script' }]} />
      </Field>
      {([
        ['borderWidth', 'Border thickness', 1, 12, 1],
        ['textSize', 'Text size', 12, 80, 1],
        ['letterSpacing', 'Letter spacing', 0, 12, 0.5],
        ['rotation', 'Rotation', -45, 45, 1],
      ] as const).map(([k, l, min, max, step]) => (
        <Field key={k} label={`${l}: ${c[k]}`}><Slider value={[c[k]]} min={min} max={max} step={step} onValueChange={(v) => onChange({ [k]: v[0] })} /></Field>
      ))}
      <Field label={`Opacity: ${Math.round(c.opacity * 100)}%`}><Slider value={[c.opacity * 100]} min={30} max={100} step={5} onValueChange={(v) => onChange({ opacity: v[0] / 100 })} /></Field>
      <div className="flex items-center gap-2"><Switch id="ink" checked={c.ink} onCheckedChange={(v) => onChange({ ink: v })} /><Label htmlFor="ink">Realistic ink texture</Label></div>
    </div>
  );
}

function StampPicker({ value, onPick }: { value: string | null; onPick: (c: StampConfig) => void }) {
  const [stamps] = useStamps();
  if (!stamps.length)
    return (
      <p className="text-sm text-muted-foreground">
        No stamps yet. <Link to="/tools/stamp-studio" className="text-primary underline">Create one in Stamp Studio</Link>.
      </p>
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      {stamps.map((s) => (
        <button key={s.id} onClick={() => onPick(s)} className={`rounded-lg border p-2 text-left transition ${value === s.id ? 'border-primary bg-secondary' : 'hover:border-primary/50'}`}>
          <StampSvg c={s} className="checker aspect-square rounded" />
          <p className="mt-1 truncate text-xs font-medium">{s.name}</p>
        </button>
      ))}
    </div>
  );
}

function StampPlacer({ initial }: { initial?: StampConfig }) {
  const [picked, setPicked] = useState<string | null>(initial?.id ?? null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const pick = async (c: StampConfig) => {
    setPicked(c.id);
    setOverlay(await stampToPng(c, 2));
  };
  useEffect(() => {
    if (initial) pick(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);
  return <PlaceOnDocument overlay={overlay} label="stamp" picker={<StampPicker value={picked} onPick={pick} />} />;
}

export const StampPdf = () => <StampPlacer />;

export function StampStudio() {
  const [stamps, setStamps] = useStamps();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState('design');
  const active = stamps.find((s) => s.id === activeId) ?? stamps[0];

  const create = (preset = STAMP_PRESETS[0]) => {
    const s = { ...preset, id: uid(), name: stamps.some((x) => x.name === preset.name) ? `${preset.name} copy` : preset.name };
    setStamps([...stamps, s]);
    setActiveId(s.id);
  };
  const update = (p: Partial<StampConfig>) => active && setStamps((list) => list.map((s) => (s.id === active.id ? { ...s, ...p } : s)));
  const remove = () => {
    setStamps(stamps.filter((s) => s.id !== active!.id));
    setActiveId(null);
  };
  const png = async () => {
    const { png } = await stampToPng(active!, 3);
    download(new Blob([dataUrlBytes(png)], { type: 'image/png' }), `${active!.name || 'stamp'}.png`);
  };

  if (!stamps.length)
    return (
      <Card>
        <p className="text-lg font-semibold">Start from a template</p>
        <p className="mb-4 text-sm text-muted-foreground">You can change every part of it afterwards.</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STAMP_PRESETS.map((p) => (
            <button key={p.name} onClick={() => create(p)} className="rounded-xl border p-3 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
              <StampSvg c={{ ...p, id: 'preview' }} className="aspect-square" />
              <p className="mt-2 text-sm font-medium">{p.name}</p>
            </button>
          ))}
        </div>
      </Card>
    );

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="design">Design stamps</TabsTrigger>
        <TabsTrigger value="place">Stamp a file</TabsTrigger>
      </TabsList>
      <TabsContent value="design">
        <div className="grid gap-5 lg:grid-cols-[220px_1fr_340px]">
          <Card className="h-fit p-3">
            <p className="mb-2 px-1 text-sm font-semibold">My stamps</p>
            <div className="space-y-1">
              {stamps.map((s) => (
                <button key={s.id} onClick={() => setActiveId(s.id)} className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm ${active?.id === s.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
                  <StampSvg c={s} className="h-8 w-8 shrink-0" />
                  <span className="truncate">{s.name}</span>
                </button>
              ))}
            </div>
            <p className="mb-1 mt-4 px-1 text-xs font-semibold uppercase text-muted-foreground">New from template</p>
            {STAMP_PRESETS.map((p) => (
              <button key={p.name} onClick={() => create(p)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm text-muted-foreground hover:bg-muted">
                <Plus className="h-4 w-4" />{p.name}
              </button>
            ))}
          </Card>
          <div className="space-y-3">
            <div className="checker flex aspect-square items-center justify-center rounded-xl border p-6 lg:aspect-[4/3]">
              {active && <StampSvg c={active} className="h-full w-full max-w-[460px]" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setTab('place')}>Stamp a file</Button>
              <Button variant="outline" onClick={png}><Download className="mr-1 h-4 w-4" />PNG</Button>
              <Button variant="outline" onClick={() => active && create({ ...active, name: active.name + ' copy' })}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline"><Trash2 className="mr-1 h-4 w-4" />Delete</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete "{active?.name}"?</AlertDialogTitle><AlertDialogDescription>This stamp will be removed from this device.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-xs text-muted-foreground">Changes save automatically. No need to download the stamp to use it.</p>
          </div>
          <Card className="h-fit">{active && <StampEditor c={active} onChange={update} />}</Card>
        </div>
      </TabsContent>
      <TabsContent value="place">
        <StampPlacer initial={active} />
      </TabsContent>
    </Tabs>
  );
}

function SignaturePicker({ value, onPick }: { value: string | null; onPick: (s: SavedSig) => void }) {
  const [sigs, setSigs] = useSignatures();
  const [adding, setAdding] = useState(!sigs.length);
  return (
    <div className="space-y-3">
      {sigs.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {sigs.map((s) => (
            <div key={s.id} className={`group relative rounded-lg border p-2 ${value === s.id ? 'border-primary bg-secondary' : ''}`}>
              <button className="block w-full" onClick={() => onPick(s)}><img src={s.png} alt="Signature" className="checker h-12 w-full rounded object-contain" /></button>
              <button onClick={() => setSigs(sigs.filter((x) => x.id !== s.id))} className="absolute right-1 top-1 hidden rounded bg-background p-0.5 group-hover:block" aria-label="Delete"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <SignaturePad doneLabel="Save signature" onDone={(s) => { const n = { ...s, id: uid() }; setSigs([...sigs, n]); onPick(n); setAdding(false); }} />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" />New signature</Button>
      )}
    </div>
  );
}

export function SignPdf() {
  const [sel, setSel] = useState<SavedSig | null>(null);
  return <PlaceOnDocument overlay={sel} label="signature" picker={<SignaturePicker value={sel?.id ?? null} onPick={setSel} />} />;
}

export function SignatureMaker() {
  const [sigs, setSigs] = useSignatures();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <SignaturePad doneLabel="Save & download" onDone={(s) => {
          setSigs([...sigs, { ...s, id: uid() }]);
          download(new Blob([dataUrlBytes(s.png)], { type: 'image/png' }), 'signature.png');
          toast.success('Saved. It is also available in Sign PDF.');
        }} />
      </Card>
      <Card>
        <p className="mb-3 font-semibold">Saved signatures</p>
        {!sigs.length && <p className="text-sm text-muted-foreground">Signatures you save appear here and in Sign PDF.</p>}
        <div className="space-y-2">
          {sigs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border p-2">
              <img src={s.png} alt="Signature" className="checker h-10 flex-1 rounded object-contain" />
              <Button size="icon" variant="ghost" onClick={() => download(new Blob([dataUrlBytes(s.png)], { type: 'image/png' }), 'signature.png')}><Download className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setSigs(sigs.filter((x) => x.id !== s.id))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
