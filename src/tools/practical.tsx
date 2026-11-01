import { useState } from 'react';
import { rgb } from 'pdf-lib';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { ActionButton, Card, Field, PrivacyNote, SegButtons, SideTitle, ToolLayout } from '../components/kit';
import { download, readAsDataUrl, dataUrlBytes } from '../lib/files';
import { PdfWriter } from '../lib/pdfWriter';
import { useStored, uid } from '../lib/storage';

export type Profile = { name: string; roll: string; course: string; semester: string; subject: string; code: string; college: string; faculty: string; session: string; logo?: string };
const emptyProfile: Profile = { name: '', roll: '', course: '', semester: '', subject: '', code: '', college: '', faculty: '', session: '' };
const useProfile = () => useStored<Profile>('profile', emptyProfile);

function ProfileFields({ fields }: { fields?: (keyof Profile)[] }) {
  const [p, setP] = useProfile();
  const labels: Record<string, string> = { name: 'Student name', roll: 'Roll / Enrollment no.', course: 'Course & branch', semester: 'Semester / Year', subject: 'Subject', code: 'Subject code', college: 'College / University', faculty: 'Submitted to', session: 'Session' };
  const list = fields ?? (Object.keys(labels) as (keyof Profile)[]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.map((k) => (
        <Field key={k} label={labels[k]}>
          <Input value={(p[k] as string) ?? ''} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
        </Field>
      ))}
    </div>
  );
}

async function drawCover(wr: PdfWriter, p: Profile, title: string, kind: string, style: 'classic' | 'modern') {
  wr.gap(30);
  if (p.logo) await wr.image(dataUrlBytes(p.logo), p.logo.slice(5, p.logo.indexOf(';')), 120, 110);
  wr.text(p.college || 'College Name', { size: 20, font: style === 'classic' ? 'serifBold' : 'bold', align: 'center' });
  wr.gap(40);
  wr.text(kind.toUpperCase(), { size: 14, font: style === 'classic' ? 'serif' : 'regular', align: 'center', color: [0.35, 0.35, 0.35] });
  wr.gap(8);
  wr.text(title || p.subject || 'Title', { size: 26, font: style === 'classic' ? 'serifBold' : 'bold', align: 'center' });
  if (p.code) wr.text(`(${p.code})`, { size: 12, align: 'center' });
  wr.gap(16);
  wr.rule(1.2);
  wr.gap(60);
  const rows: [string, string][] = [
    ['Submitted by', p.name], ['Roll No.', p.roll], ['Course', p.course], ['Semester', p.semester], ['Submitted to', p.faculty], ['Session', p.session],
  ].filter(([, v]) => v) as [string, string][];
  rows.forEach(([k, v]) => wr.text(`${k}:   ${v}`, { size: 13, align: 'center', font: style === 'classic' ? 'serif' : 'regular', gap: 1.9 }));
  wr.page.drawRectangle({ x: 24, y: 24, width: wr.w - 48, height: wr.h - 48, borderWidth: style === 'classic' ? 2 : 0.8, borderColor: rgb(0.2, 0.2, 0.2) });
}

export function CoverPage() {
  const [p, setP] = useProfile();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('Assignment');
  const [style, setStyle] = useState<'classic' | 'modern'>('classic');
  const [busy, setBusy] = useState(false);
  return (
    <ToolLayout
      main={
        <Card>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="Title"><Input value={title} placeholder="e.g. Data Structures Lab" onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Document type">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['Assignment', 'Practical File', 'Project Report', 'Lab Manual', 'Internship Report', 'Seminar Report'].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <ProfileFields />
          <Field label="College logo (optional)"><Input type="file" accept="image/png,image/jpeg" onChange={async (e) => e.target.files?.[0] && setP({ ...p, logo: await readAsDataUrl(e.target.files[0]) })} /></Field>
        </Card>
      }
      side={
        <>
          <SideTitle>Style</SideTitle>
          <SegButtons value={style} onChange={setStyle} options={[{ value: 'classic', label: 'Classic' }, { value: 'modern', label: 'Modern' }]} />
          <p className="mt-3 text-xs text-muted-foreground">Your details are remembered for the other practical file tools.</p>
          <ActionButton busy={busy} onClick={async () => {
            setBusy(true);
            const wr = await PdfWriter.create('A4', 60);
            await drawCover(wr, p, title, kind, style);
            download(await wr.save(), 'cover-page.pdf', 'application/pdf');
            setBusy(false);
          }}>Download cover page</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

type Row = { id: string; title: string; date: string; page: string };

export function IndexPage() {
  const [rows, setRows] = useStored<Row[]>('index-rows', [{ id: 'a', title: '', date: '', page: '' }]);
  const [heading, setHeading] = useState('INDEX');
  const [busy, setBusy] = useState(false);
  const upd = (id: string, k: keyof Row, v: string) => setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  return (
    <ToolLayout
      main={
        <Card className="space-y-2">
          <div className="grid grid-cols-[2rem_1fr_8rem_5rem_2rem] gap-2 text-xs font-semibold text-muted-foreground"><span>#</span><span>Title / Experiment</span><span>Date</span><span>Page</span><span /></div>
          {rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[2rem_1fr_8rem_5rem_2rem] items-center gap-2">
              <span className="text-sm">{i + 1}</span>
              <Input value={r.title} onChange={(e) => upd(r.id, 'title', e.target.value)} />
              <Input value={r.date} placeholder="dd/mm/yyyy" onChange={(e) => upd(r.id, 'date', e.target.value)} />
              <Input value={r.page} onChange={(e) => upd(r.id, 'page', e.target.value)} />
              <Button size="icon" variant="ghost" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { id: uid(), title: '', date: '', page: '' }])}><Plus className="mr-1 h-4 w-4" />Add row</Button>
        </Card>
      }
      side={
        <>
          <SideTitle>Page</SideTitle>
          <Field label="Heading"><Input value={heading} onChange={(e) => setHeading(e.target.value)} /></Field>
          <ActionButton busy={busy} onClick={async () => {
            setBusy(true);
            const wr = await PdfWriter.create('A4', 48);
            wr.text(heading, { size: 20, font: 'bold', align: 'center' });
            wr.gap(14);
            wr.table([{ label: 'S.No.', width: 0.08 }, { label: 'Title', width: 0.47 }, { label: 'Date', width: 0.15 }, { label: 'Page', width: 0.1 }, { label: 'Signature', width: 0.2 }], rows.map((r, i) => [String(i + 1), r.title, r.date, r.page, '']), 11);
            download(await wr.save(), 'index.pdf', 'application/pdf');
            setBusy(false);
          }}>Download index</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

type CodeFile = { id: string; name: string; code: string };

export function CodeToPdf() {
  const [files, setFiles] = useStored<CodeFile[]>('code-files', [{ id: 'a', name: 'main.c', code: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}' }]);
  const [lineNo, setLineNo] = useState(true);
  const [size, setSize] = useState('9');
  const [busy, setBusy] = useState(false);
  const upd = (id: string, p: Partial<CodeFile>) => setFiles(files.map((f) => (f.id === id ? { ...f, ...p } : f)));
  return (
    <ToolLayout
      main={
        <>
          {files.map((f) => (
            <Card key={f.id} className="space-y-2">
              <div className="flex gap-2">
                <Input value={f.name} onChange={(e) => upd(f.id, { name: e.target.value })} className="font-mono" />
                <Button size="icon" variant="ghost" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Textarea value={f.code} onChange={(e) => upd(f.id, { code: e.target.value })} className="min-h-[200px] font-mono text-xs" spellCheck={false} />
            </Card>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFiles([...files, { id: uid(), name: `program${files.length + 1}.py`, code: '' }])}><Plus className="mr-1 h-4 w-4" />Add program</Button>
            <Button variant="outline" asChild><label className="cursor-pointer">Import files<input hidden type="file" multiple onChange={async (e) => {
              const list = await Promise.all(Array.from(e.target.files ?? []).map(async (x) => ({ id: uid(), name: x.name, code: await x.text() })));
              setFiles([...files, ...list]);
            }} /></label></Button>
          </div>
        </>
      }
      side={
        <>
          <SideTitle>Output</SideTitle>
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Switch id="ln" checked={lineNo} onCheckedChange={setLineNo} /><Label htmlFor="ln">Line numbers</Label></div>
            <Field label="Font size"><Input type="number" value={size} onChange={(e) => setSize(e.target.value)} /></Field>
          </div>
          <ActionButton busy={busy} disabled={!files.length} onClick={async () => {
            setBusy(true);
            const wr = await PdfWriter.create('A4', 44);
            files.forEach((f, i) => {
              if (i) wr.newPage();
              wr.text(f.name, { size: 13, font: 'monoBold' });
              wr.gap(6);
              wr.codeBlock(f.code, Number(size) || 9, lineNo);
            });
            wr.footer((n, t) => `${n} / ${t}`);
            download(await wr.save(), 'code.pdf', 'application/pdf');
            setBusy(false);
          }}>Download PDF</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

type Experiment = { id: string; title: string; date: string; aim: string; theory: string; code: string; output: string; outputImg?: string; conclusion: string };
const blankExp = (): Experiment => ({ id: uid(), title: '', date: '', aim: '', theory: '', code: '', output: '', conclusion: '' });

function ExperimentCard({ e, i, onChange, onRemove }: { e: Experiment; i: number; onChange: (p: Partial<Experiment>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(i === 0);
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-accent px-2 py-0.5 font-mono text-xs text-accent-foreground">#{i + 1}</span>
        <Input value={e.title} placeholder="Experiment title" onChange={(x) => onChange({ title: x.target.value })} />
        <Button size="icon" variant="ghost" onClick={() => setOpen(!open)}>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
        <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {open && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date"><Input value={e.date} placeholder="dd/mm/yyyy" onChange={(x) => onChange({ date: x.target.value })} /></Field>
            <Field label="Aim"><Input value={e.aim} onChange={(x) => onChange({ aim: x.target.value })} /></Field>
          </div>
          <Field label="Theory / Algorithm"><Textarea value={e.theory} onChange={(x) => onChange({ theory: x.target.value })} /></Field>
          <Field label="Code"><Textarea value={e.code} className="min-h-[140px] font-mono text-xs" spellCheck={false} onChange={(x) => onChange({ code: x.target.value })} /></Field>
          <Field label="Output (text)"><Textarea value={e.output} className="font-mono text-xs" onChange={(x) => onChange({ output: x.target.value })} /></Field>
          <Field label="Output screenshot">
            <Input type="file" accept="image/png,image/jpeg" onChange={async (x) => x.target.files?.[0] && onChange({ outputImg: await readAsDataUrl(x.target.files[0]) })} />
          </Field>
          {e.outputImg && <img src={e.outputImg} alt="Output" className="max-h-40 rounded border" />}
          <Field label="Conclusion / Result"><Textarea value={e.conclusion} onChange={(x) => onChange({ conclusion: x.target.value })} /></Field>
        </div>
      )}
    </Card>
  );
}

export function PracticalFile() {
  const [p] = useProfile();
  const [exps, setExps] = useStored<Experiment[]>('practical', [blankExp()]);
  const [style, setStyle] = useState<'classic' | 'modern'>('classic');
  const [busy, setBusy] = useState(false);
  const build = async () => {
    setBusy(true);
    try {
      const wr = await PdfWriter.create('A4', 54);
      await drawCover(wr, p, p.subject ? `${p.subject} Lab` : 'Practical File', 'Practical File', style);
      wr.newPage();
      wr.text('INDEX', { size: 20, font: 'bold', align: 'center' });
      wr.gap(12);
      wr.table([{ label: 'S.No.', width: 0.08 }, { label: 'Experiment', width: 0.52 }, { label: 'Date', width: 0.18 }, { label: 'Signature', width: 0.22 }], exps.map((e, i) => [String(i + 1), e.title, e.date, '']), 10);
      for (const [i, e] of exps.entries()) {
        wr.newPage();
        wr.text(`Experiment ${i + 1}`, { size: 11, color: [0.4, 0.4, 0.4] });
        wr.text(e.title || 'Untitled', { size: 17, font: 'bold' });
        if (e.date) wr.text(`Date: ${e.date}`, { size: 10, align: 'right' });
        wr.rule();
        const section = (h: string, body: string) => { if (!body.trim()) return; wr.gap(6); wr.text(h, { size: 12, font: 'bold' }); wr.text(body); };
        section('Aim', e.aim);
        section('Theory', e.theory);
        if (e.code.trim()) { wr.gap(6); wr.text('Code', { size: 12, font: 'bold' }); wr.gap(3); wr.codeBlock(e.code, 8.5, true); }
        if (e.output.trim()) { wr.gap(6); wr.text('Output', { size: 12, font: 'bold' }); wr.gap(3); wr.codeBlock(e.output, 8.5, false); }
        if (e.outputImg) await wr.image(dataUrlBytes(e.outputImg), e.outputImg.slice(5, e.outputImg.indexOf(';')), wr.contentWidth, 320);
        section('Result', e.conclusion);
      }
      wr.footer((n) => (n === 1 ? '' : `${p.name ? p.name + '  |  ' : ''}Page ${n}`));
      download(await wr.save(), `${(p.subject || 'practical').replace(/\s+/g, '_')}_file.pdf`, 'application/pdf');
      toast.success('Practical file ready');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolLayout
      main={
        <>
          <Card><p className="mb-3 font-semibold">Your details</p><ProfileFields fields={['name', 'roll', 'course', 'semester', 'subject', 'code', 'college', 'faculty', 'session']} /></Card>
          {exps.map((e, i) => (
            <ExperimentCard key={e.id} e={e} i={i} onChange={(pp) => setExps(exps.map((x) => (x.id === e.id ? { ...x, ...pp } : x)))} onRemove={() => setExps(exps.filter((x) => x.id !== e.id))} />
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setExps([...exps, blankExp()])}><Plus className="mr-1 h-4 w-4" />Add experiment</Button>
            {exps.length > 0 && <Button variant="outline" onClick={() => setExps([...exps, { ...exps[exps.length - 1], id: uid(), title: exps[exps.length - 1].title + ' (copy)' }])}><Copy className="mr-1 h-4 w-4" />Duplicate last</Button>}
          </div>
        </>
      }
      side={
        <>
          <SideTitle>Build file</SideTitle>
          <p className="text-sm">{exps.length} experiment(s). Includes cover page, index and page numbers.</p>
          <div className="mt-3"><SegButtons value={style} onChange={setStyle} options={[{ value: 'classic', label: 'Classic' }, { value: 'modern', label: 'Modern' }]} /></div>
          <p className="mt-3 text-xs text-muted-foreground">Everything autosaves, so you can come back and add experiments later.</p>
          <ActionButton busy={busy} disabled={!exps.length} onClick={build}>Generate PDF</ActionButton>
          <PrivacyNote />
        </>
      }
    />
  );
}

type Src = { type: 'website' | 'book' | 'journal'; authors: string; title: string; site: string; publisher: string; year: string; url: string; accessed: string; volume: string; pages: string };

function cite(s: Src, style: 'APA' | 'MLA' | 'IEEE') {
  const authors = s.authors.split(';').map((a) => a.trim()).filter(Boolean);
  const year = s.year || 'n.d.';
  const apaA = authors.map((a) => { const [last, ...rest] = a.split(' ').reverse(); return `${last}, ${rest.reverse().map((x) => x[0] + '.').join(' ')}`.trim(); }).join(', ');
  const ieeeA = authors.map((a) => { const parts = a.split(' '); const last = parts.pop(); return `${parts.map((x) => x[0] + '.').join(' ')} ${last}`.trim(); }).join(', ');
  const mlaA = authors.length ? (() => { const parts = authors[0].split(' '); const last = parts.pop(); return `${last}, ${parts.join(' ')}${authors.length > 1 ? ', et al' : ''}`; })() : '';
  if (style === 'APA') {
    if (s.type === 'book') return `${apaA} (${year}). ${s.title}. ${s.publisher}.`;
    if (s.type === 'journal') return `${apaA} (${year}). ${s.title}. ${s.site}${s.volume ? `, ${s.volume}` : ''}${s.pages ? `, ${s.pages}` : ''}.${s.url ? ' ' + s.url : ''}`;
    return `${apaA ? apaA + ' ' : ''}(${year}). ${s.title}. ${s.site}. ${s.url}`;
  }
  if (style === 'MLA') {
    if (s.type === 'book') return `${mlaA}. ${s.title}. ${s.publisher}, ${year}.`;
    if (s.type === 'journal') return `${mlaA}. "${s.title}." ${s.site}${s.volume ? `, vol. ${s.volume}` : ''}, ${year}${s.pages ? `, pp. ${s.pages}` : ''}.`;
    return `${mlaA ? mlaA + '. ' : ''}"${s.title}." ${s.site}, ${year}, ${s.url}.${s.accessed ? ` Accessed ${s.accessed}.` : ''}`;
  }
  if (s.type === 'book') return `${ieeeA}, ${s.title}. ${s.publisher}, ${year}.`;
  if (s.type === 'journal') return `${ieeeA}, "${s.title}," ${s.site}${s.volume ? `, vol. ${s.volume}` : ''}${s.pages ? `, pp. ${s.pages}` : ''}, ${year}.`;
  return `${ieeeA ? ieeeA + ', ' : ''}"${s.title}," ${s.site}. [Online]. Available: ${s.url}${s.accessed ? ` (accessed ${s.accessed})` : ''}.`;
}

export function Citation() {
  const [s, setS] = useState<Src>({ type: 'website', authors: '', title: '', site: '', publisher: '', year: '', url: '', accessed: '', volume: '', pages: '' });
  const [style, setStyle] = useState<'APA' | 'MLA' | 'IEEE'>('APA');
  const [list, setList] = useStored<string[]>('citations', []);
  const f = (k: keyof Src, label: string, ph = '') => <Field label={label}><Input value={s[k]} placeholder={ph} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>;
  const result = cite(s, style);
  return (
    <ToolLayout
      main={
        <Card className="space-y-3">
          <SegButtons value={s.type} onChange={(v) => setS({ ...s, type: v })} options={[{ value: 'website', label: 'Website' }, { value: 'book', label: 'Book' }, { value: 'journal', label: 'Journal' }]} />
          <div className="grid gap-3 sm:grid-cols-2">
            {f('authors', 'Authors', 'Jane Doe; John Smith')}
            {f('title', 'Title')}
            {s.type !== 'book' && f('site', s.type === 'journal' ? 'Journal name' : 'Website name')}
            {s.type === 'book' && f('publisher', 'Publisher')}
            {f('year', 'Year')}
            {s.type === 'journal' && f('volume', 'Volume (issue)')}
            {s.type === 'journal' && f('pages', 'Pages', '12-25')}
            {s.type !== 'book' && f('url', 'URL / DOI')}
            {s.type === 'website' && f('accessed', 'Accessed on', '31 Oct 2026')}
          </div>
        </Card>
      }
      side={
        <>
          <SideTitle>Citation</SideTitle>
          <SegButtons value={style} onChange={setStyle} options={[{ value: 'APA', label: 'APA' }, { value: 'MLA', label: 'MLA' }, { value: 'IEEE', label: 'IEEE' }]} />
          <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{result}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied'); }}>Copy</Button>
            <Button onClick={() => setList([...list, result])}>Add to list</Button>
          </div>
          {list.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-semibold">Bibliography ({list.length})</p>
              {list.map((c, i) => (
                <div key={i} className="flex gap-2 text-xs"><span className="flex-1">[{i + 1}] {c}</span><button onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></button></div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => { navigator.clipboard.writeText(list.map((c, i) => (style === 'IEEE' ? `[${i + 1}] ` : '') + c).join('\n')); toast.success('Copied all'); }}>Copy all</Button>
            </div>
          )}
        </>
      }
    />
  );
}
