import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Slider } from '@project/components/ui/slider';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Button } from '@project/components/ui/button';
import { Pipette, Trash2, Copy, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { SegButtons } from '../../components/kit';
import type { FontFam, Obj } from './model';

const Num = ({ label, v, on, step = 0.5 }: { label: string; v: number; on: (n: number) => void; step?: number }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input type="number" step={step} value={Number(v.toFixed(2))} onChange={(e) => on(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs" />
  </div>
);

export function ColorField({ label, v, on, onPick }: { label: string; v: string; on: (c: string) => void; onPick: () => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1.5">
        <input type="color" value={v === 'none' ? '#ffffff' : v} onChange={(e) => on(e.target.value)} className="h-8 w-10 cursor-pointer rounded border bg-transparent" />
        <Input value={v} onChange={(e) => on(e.target.value)} className="h-8 font-mono text-xs" />
        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" title="Pick colour from page" onClick={onPick}><Pipette className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

type P = { o: Obj; set: (p: Partial<Obj>) => void; pick: (field: string) => void; del: () => void; dup: () => void; order: (d: 1 | -1) => void };

export default function Inspector({ o, set, pick, del, dup, order }: P) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold capitalize">{o.kind === 'pen' ? 'Drawing' : o.kind}</p>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Bring forward" onClick={() => order(1)}><ArrowUpToLine className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Send backward" onClick={() => order(-1)}><ArrowDownToLine className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicate" onClick={dup}><Copy className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete" onClick={del}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {o.kind === 'text' && (
        <>
          <Textarea autoFocus rows={3} value={o.text} onChange={(e) => set({ text: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Num label="Font size" v={o.size} on={(n) => set({ size: Math.max(1, n) })} step={0.25} />
            <ColorField label="Colour" v={o.color} on={(c) => set({ color: c })} onPick={() => pick('color')} />
          </div>
          <SegButtons value={o.font} onChange={(f: FontFam) => set({ font: f })} options={[{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }]} />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><Switch checked={o.bold} onCheckedChange={(b) => set({ bold: b })} />Bold</label>
            <label className="flex items-center gap-2"><Switch checked={o.italic} onCheckedChange={(b) => set({ italic: b })} />Italic</label>
          </div>
        </>
      )}
      {o.kind === 'rect' && (
        <div className="grid grid-cols-1 gap-2">
          <ColorField label="Fill" v={o.fill} on={(c) => set({ fill: c })} onPick={() => pick('fill')} />
          <ColorField label="Border" v={o.stroke} on={(c) => set({ stroke: c })} onPick={() => pick('stroke')} />
          <Num label="Border width" v={o.strokeW} on={(n) => set({ strokeW: Math.max(0, n) })} />
          <Button size="sm" variant="outline" onClick={() => set({ fill: 'none' })}>No fill</Button>
        </div>
      )}
      {o.kind === 'pen' && (
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Colour" v={o.color} on={(c) => set({ color: c })} onPick={() => pick('color')} />
          <Num label="Stroke" v={o.width} on={(n) => set({ width: Math.max(0.25, n) })} step={0.25} />
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        <Num label="X" v={o.x} on={(n) => set({ x: n })} />
        <Num label="Y" v={o.y} on={(n) => set({ y: n })} />
        {(o.kind === 'rect' || o.kind === 'image') && <Num label="W" v={o.w} on={(n) => set({ w: Math.max(1, n) })} />}
        {(o.kind === 'rect' || o.kind === 'image') && <Num label="H" v={o.h} on={(n) => set({ h: Math.max(1, n) })} />}
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Opacity {Math.round(o.opacity * 100)}%</Label>
        <Slider min={0} max={1} step={0.01} value={[o.opacity]} onValueChange={([v]) => set({ opacity: v })} />
      </div>
      <p className="text-[11px] text-muted-foreground">Arrow keys nudge 0.5 units · Shift+arrow 5 · Delete removes</p>
    </div>
  );
}
