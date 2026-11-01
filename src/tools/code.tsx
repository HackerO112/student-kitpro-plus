import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, RefreshCw } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Slider } from '@project/components/ui/slider';
import { Switch } from '@project/components/ui/switch';
import { Label } from '@project/components/ui/label';
import { Card, Field, SegButtons } from '../components/kit';
import { download } from '../lib/files';

const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('Copied'); };

export function JsonFormatter() {
  const [input, setInput] = useState('{"name":"StudentKit","tools":42,"free":true}');
  const [indent, setIndent] = useState<'2' | '4' | 'min'>('2');
  const res = useMemo(() => {
    try {
      const v = JSON.parse(input);
      return { ok: true, out: indent === 'min' ? JSON.stringify(v) : JSON.stringify(v, null, Number(indent)) };
    } catch (e) {
      return { ok: false, out: (e as Error).message };
    }
  }, [input, indent]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-60"><SegButtons value={indent} onChange={setIndent} options={[{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'min', label: 'Minify' }]} /></div>
        <span className={`text-sm font-semibold ${res.ok ? 'text-primary' : 'text-destructive'}`}>{res.ok ? '✓ Valid JSON' : '✗ Invalid'}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={!res.ok} onClick={() => copy(res.out)}><Copy className="mr-1 h-4 w-4" />Copy</Button>
          <Button variant="outline" size="sm" disabled={!res.ok} onClick={() => download(res.out, 'formatted.json')}>Download</Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[460px] font-mono text-xs" spellCheck={false} />
        <pre className={`min-h-[460px] overflow-auto rounded-md border p-3 font-mono text-xs ${res.ok ? 'bg-muted' : 'bg-destructive/10 text-destructive'}`}>{res.out}</pre>
      </div>
    </div>
  );
}

export function RegexTester() {
  const [pattern, setPattern] = useState('\\b(\\w+)@(\\w+)\\.com\\b');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('Contact: priya@college.com, raj@mail.com');
  const res = useMemo(() => {
    try {
      const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      return { matches: [...text.matchAll(re)].slice(0, 500), err: '' };
    } catch (e) {
      return { matches: [] as RegExpMatchArray[], err: (e as Error).message };
    }
  }, [pattern, flags, text]);
  const highlighted = useMemo(() => {
    if (res.err || !res.matches.length) return [text];
    const parts: (string | JSX.Element)[] = [];
    let last = 0;
    res.matches.forEach((m, i) => {
      const s = m.index ?? 0;
      if (!m[0]) return;
      parts.push(text.slice(last, s));
      parts.push(<mark key={i} className="rounded bg-accent px-0.5 text-accent-foreground">{m[0]}</mark>);
      last = s + m[0].length;
    });
    parts.push(text.slice(last));
    return parts;
  }, [res, text]);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-md border bg-card px-3 font-mono text-sm">/<input className="flex-1 bg-transparent px-1 py-2 outline-none" value={pattern} onChange={(e) => setPattern(e.target.value)} />/</div>
          <Input value={flags} onChange={(e) => setFlags(e.target.value.replace(new RegExp('[^gimsuy]', 'g'), ''))} className="w-20 font-mono" />
        </div>
        {res.err && <p className="text-sm text-destructive">{res.err}</p>}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[160px] font-mono text-sm" />
        <Card className="whitespace-pre-wrap font-mono text-sm">{highlighted}</Card>
      </div>
      <Card className="h-fit">
        <p className="mb-2 font-semibold">{res.matches.length} match(es)</p>
        <div className="max-h-[420px] space-y-2 overflow-auto text-xs">
          {res.matches.map((m, i) => (
            <div key={i} className="rounded-md bg-muted p-2 font-mono">
              <p><b>{i + 1}.</b> "{m[0]}" at {m.index}</p>
              {m.slice(1).map((g, j) => <p key={j} className="text-muted-foreground">Group {j + 1}: {g ?? '—'}</p>)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const SETS = { lower: 'abcdefghijkmnopqrstuvwxyz', upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', digits: '23456789', symbols: '!@#$%^&*()-_=+[]{};:,.?' };
type SetKey = keyof typeof SETS;
const SET_KEYS = Object.keys(SETS) as SetKey[];
function gen(len: number, opts: Record<SetKey, boolean>) {
  const pool = SET_KEYS.filter((k) => opts[k]).map((k) => SETS[k]).join('') || SETS.lower;
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => pool[n % pool.length]).join('');
}

export function PasswordGenerator() {
  const [len, setLen] = useState(16);
  const [opts, setOpts] = useState({ lower: true, upper: true, digits: true, symbols: true });
  const [seed, setSeed] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pw = useMemo(() => gen(len, opts), [len, opts, seed]);
  const poolSize = SET_KEYS.filter((k) => opts[k]).reduce((a, k) => a + SETS[k].length, 0) || 25;
  const bits = Math.round(len * Math.log2(poolSize));
  const strength = bits < 50 ? ['Weak', 'text-destructive'] : bits < 80 ? ['Good', 'text-accent-foreground'] : ['Very strong', 'text-primary'];
  return (
    <Card className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2 rounded-lg bg-muted p-4">
        <code className="flex-1 break-all font-mono text-lg">{pw}</code>
        <Button size="icon" variant="ghost" onClick={() => setSeed(seed + 1)}><RefreshCw className="h-4 w-4" /></Button>
        <Button size="icon" onClick={() => copy(pw)}><Copy className="h-4 w-4" /></Button>
      </div>
      <p className={`text-sm font-semibold ${strength[1]}`}>{strength[0]} · ~{bits} bits of entropy</p>
      <Field label={`Length ${len}`}><Slider value={[len]} min={6} max={64} onValueChange={(v) => setLen(v[0])} /></Field>
      <div className="grid grid-cols-2 gap-3">
        {SET_KEYS.map((k) => (
          <div key={k} className="flex items-center gap-2"><Switch id={k} checked={opts[k]} onCheckedChange={(v) => setOpts({ ...opts, [k]: v })} /><Label htmlFor={k} className="capitalize">{k}</Label></div>
        ))}
      </div>
    </Card>
  );
}

type Op = { t: 'same' | 'add' | 'del'; line: string };
function diffLines(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  if (n * m > 4_000_000) return [...a.map((line) => ({ t: 'del' as const, line })), ...b.map((line) => ({ t: 'add' as const, line }))];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: 'same', line: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: 'del', line: a[i++] });
    else out.push({ t: 'add', line: b[j++] });
  }
  while (i < n) out.push({ t: 'del', line: a[i++] });
  while (j < m) out.push({ t: 'add', line: b[j++] });
  return out;
}

export function TextCompare() {
  const [a, setA] = useState('The quick brown fox\njumps over\nthe lazy dog');
  const [b, setB] = useState('The quick brown fox\nleaps over\nthe lazy dog\nand runs away');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const ops = useMemo(() => {
    const norm = (s: string) => s.split('\n').map((l) => (ignoreCase ? l.toLowerCase() : l));
    return diffLines(norm(a), norm(b));
  }, [a, b, ignoreCase]);
  const adds = ops.filter((o) => o.t === 'add').length;
  const dels = ops.filter((o) => o.t === 'del').length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Original"><Textarea value={a} onChange={(e) => setA(e.target.value)} className="min-h-[200px] font-mono text-xs" /></Field>
        <Field label="Changed"><Textarea value={b} onChange={(e) => setB(e.target.value)} className="min-h-[200px] font-mono text-xs" /></Field>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-primary">+{adds} added</span>
        <span className="text-destructive">−{dels} removed</span>
        <div className="ml-auto flex items-center gap-2"><Switch id="ic" checked={ignoreCase} onCheckedChange={setIgnoreCase} /><Label htmlFor="ic">Ignore case</Label></div>
      </div>
      <div className="overflow-auto rounded-xl border bg-card font-mono text-xs">
        {ops.map((o, i) => (
          <div key={i} className={`flex px-3 py-0.5 ${o.t === 'add' ? 'bg-primary/10' : o.t === 'del' ? 'bg-destructive/10' : ''}`}>
            <span className="w-5 shrink-0 text-muted-foreground">{o.t === 'add' ? '+' : o.t === 'del' ? '−' : ' '}</span>
            <span className="whitespace-pre-wrap">{o.line || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const WS_RE = new RegExp('\\s', 'g');
const SPLIT_WS = new RegExp('\\s+');
const SENT_RE = new RegExp('[^.!?]+[.!?]+', 'g');
const PARA_RE = new RegExp('\\n\\s*\\n');
const WORD_RE = new RegExp("[a-z']{4,}", 'g');

export function WordCounter() {
  const [t, setT] = useState('');
  const count = t.trim() ? t.trim().split(SPLIT_WS).length : 0;
  const stats: [string, string | number][] = [
    ['Words', count],
    ['Characters', t.length],
    ['No spaces', t.replace(WS_RE, '').length],
    ['Sentences', (t.match(SENT_RE) ?? []).length],
    ['Paragraphs', t.split(PARA_RE).filter((p) => p.trim()).length],
    ['Reading time', `${Math.max(count ? 1 : 0, Math.round(count / 220))} min`],
    ['Speaking time', `${Math.max(count ? 1 : 0, Math.round(count / 130))} min`],
  ];
  const top = useMemo(() => {
    const m = new Map<string, number>();
    (t.toLowerCase().match(WORD_RE) ?? []).forEach((w) => m.set(w, (m.get(w) ?? 0) + 1));
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  }, [t]);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Textarea value={t} onChange={(e) => setT(e.target.value)} placeholder="Paste or type your essay…" className="min-h-[460px] lg:col-span-2" />
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {stats.map(([k, v]) => <Card key={k} className="p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{k}</p></Card>)}
        </div>
        {top.length > 0 && (
          <Card className="p-3">
            <p className="mb-2 text-sm font-semibold">Most used</p>
            {top.map(([w, c]) => <p key={w} className="flex justify-between text-sm"><span>{w}</span><span className="text-muted-foreground">{c}</span></p>)}
          </Card>
        )}
      </div>
    </div>
  );
}

const CAMEL_RE = new RegExp('([a-z])([A-Z])', 'g');
const SEP_RE = new RegExp('[\\s_\\-]+');
const splitWords = (s: string) => s.replace(CAMEL_RE, '$1 $2').split(SEP_RE).filter(Boolean);
const cap = (w: string) => w[0].toUpperCase() + w.slice(1).toLowerCase();
const CASES: [string, (s: string) => string][] = [
  ['UPPER CASE', (s) => s.toUpperCase()],
  ['lower case', (s) => s.toLowerCase()],
  ['Title Case', (s) => s.toLowerCase().replace(new RegExp('\\b\\w', 'g'), (c) => c.toUpperCase())],
  ['Sentence case', (s) => s.toLowerCase().replace(new RegExp('(^\\s*\\w|[.!?]\\s+\\w)', 'g'), (c) => c.toUpperCase())],
  ['camelCase', (s) => splitWords(s).map((w, i) => (i ? cap(w) : w.toLowerCase())).join('')],
  ['PascalCase', (s) => splitWords(s).map(cap).join('')],
  ['snake_case', (s) => splitWords(s).map((w) => w.toLowerCase()).join('_')],
  ['kebab-case', (s) => splitWords(s).map((w) => w.toLowerCase()).join('-')],
  ['aLtErNaTe', (s) => [...s].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('')],
];

export function CaseConverter() {
  const [t, setT] = useState('hello world from studentkit');
  return (
    <div className="space-y-4">
      <Textarea value={t} onChange={(e) => setT(e.target.value)} className="min-h-[140px]" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {CASES.map(([name, fn]) => {
          const out = t ? fn(t) : '';
          return (
            <Card key={name} className="p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">{name}</p>
                <Button size="sm" variant="ghost" onClick={() => copy(out)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <p className="break-all font-mono text-sm">{out}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
