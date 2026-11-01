import { useRef, useState, type ReactNode } from 'react';
import { Upload, Lock, Loader2 } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { Label } from '@project/components/ui/label';
import { Button } from '@project/components/ui/button';

export function ToolLayout({ main, side }: { main: ReactNode; side?: ReactNode }) {
  if (!side) return <div className="space-y-4">{main}</div>;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">{main}</div>
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:sticky lg:top-20">{side}</div>
      </div>
    </div>
  );
}

export function SideTitle({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PrivacyNote() {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5" /> Files never leave your device
    </p>
  );
}

export function ActionButton({ busy, children, disabled, onClick }: { busy?: boolean; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <Button className="mt-5 h-11 w-full text-base font-semibold" disabled={disabled || busy} onClick={onClick}>
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border bg-card p-5 shadow-sm', className)}>{children}</div>;
}

export function FileDrop({
  accept, multiple = true, onFiles, label, compact,
}: { accept: string; multiple?: boolean; onFiles: (f: File[]) => void; label?: string; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/50 text-center transition-colors hover:border-primary hover:bg-secondary',
        compact ? 'h-24' : 'h-44',
        over && 'border-primary bg-secondary',
      )}
    >
      <div className="rounded-full bg-background p-3 shadow-sm">
        <Upload className="h-5 w-5 text-primary" />
      </div>
      <p className="font-medium">{label ?? 'Drop files or click to browse'}</p>
      <p className="text-xs text-muted-foreground">{accept.replace(/,/g, ', ')}</p>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          if (f.length) onFiles(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function SegButtons<T extends string>({ value, options, onChange }: { value: T; options: { value: NoInfer<T>; label: string }[]; onChange: (v: NoInfer<T>) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn('flex-1 rounded-md px-3 py-1.5 text-sm transition-all', value === o.value ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
