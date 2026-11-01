import { useEffect, useMemo, useRef, useState } from 'react';
import { format, differenceInCalendarDays, parseISO, subDays } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Trash2, Play, Pause, RotateCcw, Check, ChevronLeft, ChevronRight, Shuffle, Printer } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Progress } from '@project/components/ui/progress';
import { DatePicker } from '@project/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Card, Empty, Field, SegButtons } from '../components/kit';
import { useStored, uid } from '../lib/storage';

// ---------- shared data shapes (read by My Semester) ----------
export type Semester = { id: string; name: string; sgpa: number; credits: number };
export type CgpaData = { scale: 10 | 4; semesters: Semester[] };
export type Subject = { id: string; name: string; attended: number; total: number };
export type AttendanceData = { target: number; subjects: Subject[] };
export type Task = { id: string; title: string; subject: string; due: string; done: boolean; priority: 'low' | 'medium' | 'high' };
export type PomodoroData = { work: number; brk: number; sessions: string[] };
export type Slot = { id: string; day: number; start: string; end: string; subject: string; room: string };
export type Deck = { id: string; name: string; cards: { id: string; q: string; a: string }[] };
export type Note = { id: string; title: string; body: string; updated: number };

export const useCgpa = () => useStored<CgpaData>('cgpa', { scale: 10, semesters: [] });
export const useAttendance = () => useStored<AttendanceData>('attendance', { target: 75, subjects: [] });
export const useTasks = () => useStored<Task[]>('assignments', []);
export const usePomodoro = () => useStored<PomodoroData>('pomodoro', { work: 25, brk: 5, sessions: [] });
export const useTimetable = () => useStored<Slot[]>('timetable', []);
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function cgpaOf(sems: Semester[]) {
  const c = sems.reduce((a, s) => a + s.credits, 0);
  return c ? sems.reduce((a, s) => a + s.sgpa * s.credits, 0) / c : 0;
}
export function attendanceStats(a: AttendanceData) {
  const att = a.subjects.reduce((x, s) => x + s.attended, 0);
  const tot = a.subjects.reduce((x, s) => x + s.total, 0);
  return { pct: tot ? (att / tot) * 100 : 0, ...skipInfo(att, tot, a.target) };
}
export function skipInfo(att: number, tot: number, target: number) {
  if (!tot) return { canSkip: 0, need: 0 };
  if ((att / tot) * 100 >= target) return { canSkip: Math.max(0, Math.floor((att * 100) / target - tot)), need: 0 };
  return { canSkip: 0, need: Math.ceil((target * tot - 100 * att) / (100 - target)) };
}
export function streakOf(sessions: string[]) {
  const days = new Set(sessions.map((s) => s.slice(0, 10)));
  let n = 0;
  let d = new Date();
  if (!days.has(format(d, 'yyyy-MM-dd'))) d = subDays(d, 1);
  while (days.has(format(d, 'yyyy-MM-dd'))) {
    n++;
    d = subDays(d, 1);
  }
  return n;
}

const num = (v: string) => (v === '' ? 0 : Number(v));

// ---------- CGPA ----------
const GRADES: Record<string, number> = { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 };

function SgpaHelper({ onAdd }: { onAdd: (sgpa: number, credits: number) => void }) {
  const [rows, setRows] = useState([{ id: uid(), credits: '4', grade: 'A' }]);
  const credits = rows.reduce((a, r) => a + num(r.credits), 0);
  const sgpa = credits ? rows.reduce((a, r) => a + num(r.credits) * GRADES[r.grade], 0) / credits : 0;
  return (
    <Card className="space-y-2">
      <p className="font-semibold">SGPA from grades</p>
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2">
          <span className="w-16 text-sm text-muted-foreground">Sub {i + 1}</span>
          <Input type="number" value={r.credits} className="w-20" onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, credits: e.target.value } : x)))} />
          <Select value={r.grade} onValueChange={(g) => setRows(rows.map((x) => (x.id === r.id ? { ...x, grade: g } : x)))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(GRADES).map((g) => <SelectItem key={g} value={g}>{g} ({GRADES[g]})</SelectItem>)}</SelectContent>
          </Select>
          <Button size="icon" variant="ghost" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={() => setRows([...rows, { id: uid(), credits: '3', grade: 'A' }])}><Plus className="mr-1 h-4 w-4" />Subject</Button>
        <span className="ml-auto text-sm">SGPA <b className="text-lg">{sgpa.toFixed(2)}</b> · {credits} credits</span>
        <Button size="sm" disabled={!credits} onClick={() => onAdd(Number(sgpa.toFixed(2)), credits)}>Add as semester</Button>
      </div>
    </Card>
  );
}

export function CgpaCalculator() {
  const [d, setD] = useCgpa();
  const cg = cgpaOf(d.semesters);
  const add = (sgpa = 0, credits = 20) => setD({ ...d, semesters: [...d.semesters, { id: uid(), name: `Semester ${d.semesters.length + 1}`, sgpa, credits }] });
  const upd = (id: string, p: Partial<Semester>) => setD({ ...d, semesters: d.semesters.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="space-y-2">
          <div className="grid grid-cols-[1fr_6rem_6rem_2.5rem] gap-2 text-xs font-semibold text-muted-foreground"><span>Semester</span><span>SGPA</span><span>Credits</span><span /></div>
          {d.semesters.map((s) => (
            <div key={s.id} className="grid grid-cols-[1fr_6rem_6rem_2.5rem] gap-2">
              <Input value={s.name} onChange={(e) => upd(s.id, { name: e.target.value })} />
              <Input type="number" step="0.01" value={s.sgpa || ''} onChange={(e) => upd(s.id, { sgpa: num(e.target.value) })} />
              <Input type="number" value={s.credits || ''} onChange={(e) => upd(s.id, { credits: num(e.target.value) })} />
              <Button size="icon" variant="ghost" onClick={() => setD({ ...d, semesters: d.semesters.filter((x) => x.id !== s.id) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {!d.semesters.length && <p className="py-4 text-center text-sm text-muted-foreground">Add your first semester.</p>}
          <Button variant="outline" size="sm" onClick={() => add()}><Plus className="mr-1 h-4 w-4" />Add semester</Button>
        </Card>
        <SgpaHelper onAdd={add} />
      </div>
      <Card className="h-fit text-center">
        <p className="text-sm text-muted-foreground">Your CGPA</p>
        <p className="text-6xl font-extrabold text-primary">{cg.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">after {d.semesters.length} semester(s)</p>
        <div className="mt-4"><SegButtons value={String(d.scale) as '10' | '4'} onChange={(v) => setD({ ...d, scale: Number(v) as 10 | 4 })} options={[{ value: '10', label: '10-point' }, { value: '4', label: '4-point' }]} /></div>
        {d.scale === 10 && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">Percentage ≈ <b>{(Math.max(0, cg - 0.75) * 10).toFixed(1)}%</b><br /><span className="text-xs text-muted-foreground">(CGPA − 0.75) × 10, used by many universities</span></p>}
      </Card>
    </div>
  );
}

// ---------- Attendance ----------
export function AttendanceCalculator() {
  const [d, setD] = useAttendance();
  const st = attendanceStats(d);
  const upd = (id: string, p: Partial<Subject>) => setD({ ...d, subjects: d.subjects.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {d.subjects.map((s) => {
          const pct = s.total ? (s.attended / s.total) * 100 : 0;
          const info = skipInfo(s.attended, s.total, d.target);
          return (
            <Card key={s.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={s.name} onChange={(e) => upd(s.id, { name: e.target.value })} className="font-semibold" />
                <Button size="icon" variant="ghost" onClick={() => setD({ ...d, subjects: d.subjects.filter((x) => x.id !== s.id) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Field label="Attended"><Input type="number" className="w-24" value={s.attended} onChange={(e) => upd(s.id, { attended: num(e.target.value) })} /></Field>
                <Field label="Total"><Input type="number" className="w-24" value={s.total} onChange={(e) => upd(s.id, { total: num(e.target.value) })} /></Field>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => upd(s.id, { attended: s.attended + 1, total: s.total + 1 })}><Check className="mr-1 h-4 w-4" />Present</Button>
                  <Button size="sm" variant="outline" onClick={() => upd(s.id, { total: s.total + 1 })}>Absent</Button>
                </div>
              </div>
              <Progress value={pct} className="h-2" />
              <p className={`text-sm ${pct >= d.target ? 'text-primary' : 'text-destructive'}`}>
                <b>{pct.toFixed(1)}%</b> · {info.need ? `Attend the next ${info.need} class(es) to reach ${d.target}%` : `You can skip ${info.canSkip} class(es) and stay above ${d.target}%`}
              </p>
            </Card>
          );
        })}
        <Button variant="outline" onClick={() => setD({ ...d, subjects: [...d.subjects, { id: uid(), name: `Subject ${d.subjects.length + 1}`, attended: 0, total: 0 }] })}><Plus className="mr-1 h-4 w-4" />Add subject</Button>
      </div>
      <Card className="h-fit space-y-4 text-center">
        <p className="text-sm text-muted-foreground">Overall attendance</p>
        <p className={`text-6xl font-extrabold ${st.pct >= d.target ? 'text-primary' : 'text-destructive'}`}>{st.pct.toFixed(1)}%</p>
        <p className="text-sm">{st.need ? `Need ${st.need} more classes` : `Can skip ${st.canSkip} classes`}</p>
        <Field label={`Target: ${d.target}%`}><Input type="number" value={d.target} onChange={(e) => setD({ ...d, target: Math.min(99, Math.max(1, num(e.target.value))) })} /></Field>
      </Card>
    </div>
  );
}

// ---------- Assignment tracker ----------
export function AssignmentTracker() {
  const [tasks, setTasks] = useTasks();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [due, setDue] = useState<Date | undefined>(new Date());
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const [q, setQ] = useState('');
  const list = tasks
    .filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
    .filter((t) => `${t.title} ${t.subject}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.due.localeCompare(b.due));
  const add = () => {
    if (!title.trim()) return toast.error('Add a title');
    setTasks([...tasks, { id: uid(), title, subject, due: format(due ?? new Date(), 'yyyy-MM-dd'), done: false, priority }]);
    setTitle('');
  };
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className="space-y-4">
      <Card className="grid items-end gap-3 md:grid-cols-[2fr_1fr_1fr_8rem_auto]">
        <Field label="Assignment"><Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="DBMS practical 6" /></Field>
        <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Due"><DatePicker value={due} onChange={setDue} /></Field>
        <Field label="Priority">
          <Select value={priority} onValueChange={(v) => setPriority(v as Task['priority'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
          </Select>
        </Field>
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64"><SegButtons value={filter} onChange={setFilter} options={[{ value: 'open', label: 'To do' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'All' }]} /></div>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
        <span className="ml-auto text-sm text-muted-foreground">{done}/{tasks.length} completed</span>
      </div>
      {!list.length ? <Empty>Nothing here. Add an assignment above.</Empty> : (
        <div className="space-y-2">
          {list.map((t) => {
            const days = differenceInCalendarDays(parseISO(t.due), new Date());
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
                <Checkbox checked={t.done} onCheckedChange={(v) => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !!v } : x)))} />
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${t.done ? 'text-muted-foreground line-through' : ''}`}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.subject || 'No subject'} · {format(parseISO(t.due), 'EEE, d MMM')}</p>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-xs ${t.priority === 'high' ? 'bg-destructive/10 text-destructive' : t.priority === 'medium' ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>{t.priority}</span>
                {!t.done && <span className={`w-20 text-right text-xs font-semibold ${days < 0 ? 'text-destructive' : days <= 2 ? 'text-accent-foreground' : 'text-muted-foreground'}`}>{days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : `in ${days}d`}</span>}
                <Button size="icon" variant="ghost" onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Pomodoro ----------
export function PomodoroTimer() {
  const [d, setD] = usePomodoro();
  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [left, setLeft] = useState(d.work * 60);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        setRunning(false);
        if (phase === 'work') {
          setD((p) => ({ ...p, sessions: [...p.sessions, new Date().toISOString()] }));
          toast.success('Focus session done! Take a break.');
          setPhase('break');
          setLeft(d.brk * 60);
        } else {
          toast('Break over. Ready to focus?');
          setPhase('work');
          setLeft(d.work * 60);
        }
        try { new AudioContext().resume(); } catch { /* ignore */ }
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  useEffect(() => {
    document.title = running ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · Focus` : 'StudentKit Pro+';
  }, [left, running]);
  const total = (phase === 'work' ? d.work : d.brk) * 60;
  const today = d.sessions.filter((s) => s.startsWith(format(new Date(), 'yyyy-MM-dd'))).length;
  const r = 110;
  const circ = 2 * Math.PI * r;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="flex flex-col items-center py-10 lg:col-span-2">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${phase === 'work' ? 'bg-secondary text-secondary-foreground' : 'bg-accent text-accent-foreground'}`}>{phase === 'work' ? 'Focus' : 'Break'}</span>
        <div className="relative my-6">
          <svg width="260" height="260" className="-rotate-90">
            <circle cx="130" cy="130" r={r} stroke="hsl(var(--muted))" strokeWidth="12" fill="none" />
            <circle cx="130" cy="130" r={r} stroke="hsl(var(--primary))" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - left / total)} style={{ transition: 'stroke-dashoffset .3s linear' }} />
          </svg>
          <p className="absolute inset-0 flex items-center justify-center font-mono text-5xl font-bold">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="lg" onClick={() => setRunning(!running)}>{running ? <><Pause className="mr-1 h-4 w-4" />Pause</> : <><Play className="mr-1 h-4 w-4" />Start</>}</Button>
          <Button size="lg" variant="outline" onClick={() => { setRunning(false); setLeft(total); }}><RotateCcw className="mr-1 h-4 w-4" />Reset</Button>
          <Button size="lg" variant="outline" onClick={() => { setRunning(false); const p = phase === 'work' ? 'break' : 'work'; setPhase(p); setLeft((p === 'work' ? d.work : d.brk) * 60); }}>Skip</Button>
        </div>
      </Card>
      <Card className="h-fit space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-muted p-3"><p className="text-3xl font-bold">{today}</p><p className="text-xs text-muted-foreground">today</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-3xl font-bold">{streakOf(d.sessions)}</p><p className="text-xs text-muted-foreground">day streak</p></div>
        </div>
        <Field label="Focus minutes"><Input type="number" value={d.work} disabled={running} onChange={(e) => { const v = Math.max(1, num(e.target.value)); setD({ ...d, work: v }); if (phase === 'work') setLeft(v * 60); }} /></Field>
        <Field label="Break minutes"><Input type="number" value={d.brk} disabled={running} onChange={(e) => { const v = Math.max(1, num(e.target.value)); setD({ ...d, brk: v }); if (phase === 'break') setLeft(v * 60); }} /></Field>
      </Card>
    </div>
  );
}

// ---------- Timetable ----------
export function TimetableMaker() {
  const [slots, setSlots] = useTimetable();
  const [form, setForm] = useState({ day: '0', start: '09:00', end: '10:00', subject: '', room: '' });
  const add = () => {
    if (!form.subject.trim()) return toast.error('Add a subject');
    setSlots([...slots, { id: uid(), ...form, day: Number(form.day) }]);
    setForm({ ...form, subject: '', room: '', start: form.end, end: `${String(Number(form.end.slice(0, 2)) + 1).padStart(2, '0')}:${form.end.slice(3)}` });
  };
  const days = DAYS.map((_, i) => i).filter((i) => i < 6 || slots.some((s) => s.day === 6));
  return (
    <div className="space-y-4">
      <Card className="grid items-end gap-3 print:hidden md:grid-cols-[8rem_7rem_7rem_2fr_1fr_auto]">
        <Field label="Day">
          <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Start"><Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
        <Field label="End"><Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
        <Field label="Subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} /></Field>
        <Field label="Room"><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></Field>
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </Card>
      <div className="flex justify-end print:hidden"><Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button></div>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {days.map((d) => (
          <div key={d} className="rounded-xl border bg-card p-3">
            <p className={`mb-2 font-semibold ${(new Date().getDay() + 6) % 7 === d ? 'text-primary' : ''}`}>{DAYS[d]}</p>
            <div className="space-y-2">
              {slots.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start)).map((s) => (
                <div key={s.id} className="group relative rounded-lg bg-secondary p-2 text-sm">
                  <p className="font-mono text-xs text-muted-foreground">{s.start}–{s.end}</p>
                  <p className="font-medium">{s.subject}</p>
                  {s.room && <p className="text-xs text-muted-foreground">{s.room}</p>}
                  <button onClick={() => setSlots(slots.filter((x) => x.id !== s.id))} className="absolute right-1 top-1 hidden rounded p-0.5 group-hover:block print:hidden" aria-label="Delete"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              {!slots.some((s) => s.day === d) && <p className="text-xs text-muted-foreground">Free</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Flashcards ----------
export function Flashcards() {
  const [decks, setDecks] = useStored<Deck[]>('flashcards', []);
  const [active, setActive] = useState<string | null>(null);
  const [study, setStudy] = useState(false);
  const deck = decks.find((d) => d.id === active) ?? decks[0];
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const updDeck = (p: Partial<Deck>) => setDecks(decks.map((d) => (d.id === deck!.id ? { ...d, ...p } : d)));
  const startStudy = (shuffle = false) => {
    const o = deck!.cards.map((_, i) => i);
    if (shuffle) o.sort(() => Math.random() - 0.5);
    setOrder(o);
    setIdx(0);
    setFlip(false);
    setStudy(true);
  };
  const card = deck && study ? deck.cards[order[idx]] : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit space-y-1 p-3">
        {decks.map((d) => (
          <button key={d.id} onClick={() => { setActive(d.id); setStudy(false); }} className={`flex w-full justify-between rounded-lg p-2 text-left text-sm ${deck?.id === d.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
            <span className="truncate">{d.name}</span><span className="text-xs">{d.cards.length}</span>
          </button>
        ))}
        <Button variant="outline" size="sm" className="w-full" onClick={() => { const n = { id: uid(), name: `Deck ${decks.length + 1}`, cards: [] }; setDecks([...decks, n]); setActive(n.id); }}><Plus className="mr-1 h-4 w-4" />New deck</Button>
      </Card>
      {!deck ? <Empty>Create a deck to start adding cards.</Empty> : study && card ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">Card {idx + 1} of {order.length} · tap to flip</p>
          <button onClick={() => setFlip(!flip)} className="flex min-h-[260px] w-full max-w-xl items-center justify-center rounded-2xl border bg-card p-8 text-center text-xl font-semibold shadow-lg transition hover:shadow-xl">
            <span className={flip ? 'text-primary' : ''}>{flip ? card.a : card.q}</span>
          </button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={idx === 0} onClick={() => { setIdx(idx - 1); setFlip(false); }}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => setStudy(false)}>Exit</Button>
            <Button variant="outline" disabled={idx === order.length - 1} onClick={() => { setIdx(idx + 1); setFlip(false); }}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input value={deck.name} onChange={(e) => updDeck({ name: e.target.value })} className="max-w-xs font-semibold" />
            <Button disabled={!deck.cards.length} onClick={() => startStudy()}>Study</Button>
            <Button variant="outline" disabled={!deck.cards.length} onClick={() => startStudy(true)}><Shuffle className="mr-1 h-4 w-4" />Shuffle</Button>
            <Button variant="ghost" onClick={() => setDecks(decks.filter((d) => d.id !== deck.id))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <Card className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input placeholder="Question" value={q} onChange={(e) => setQ(e.target.value)} />
            <Input placeholder="Answer" value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && q && a) { updDeck({ cards: [...deck.cards, { id: uid(), q, a }] }); setQ(''); setA(''); } }} />
            <Button disabled={!q || !a} onClick={() => { updDeck({ cards: [...deck.cards, { id: uid(), q, a }] }); setQ(''); setA(''); }}>Add card</Button>
          </Card>
          <div className="grid gap-2 md:grid-cols-2">
            {deck.cards.map((c) => (
              <div key={c.id} className="flex gap-2 rounded-lg border bg-card p-3 text-sm">
                <div className="flex-1"><p className="font-medium">{c.q}</p><p className="text-muted-foreground">{c.a}</p></div>
                <button onClick={() => updDeck({ cards: deck.cards.filter((x) => x.id !== c.id) })}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Notes ----------
export function QuickNotes() {
  const [notes, setNotes] = useStored<Note[]>('notes', []);
  const [active, setActive] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const sorted = useMemo(() => [...notes].sort((a, b) => b.updated - a.updated).filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())), [notes, q]);
  const note = notes.find((n) => n.id === active) ?? sorted[0];
  const upd = (p: Partial<Note>) => setNotes(notes.map((n) => (n.id === note!.id ? { ...n, ...p, updated: Date.now() } : n)));
  const create = () => { const n = { id: uid(), title: 'Untitled note', body: '', updated: Date.now() }; setNotes([...notes, n]); setActive(n.id); };
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit space-y-2 p-3">
        <Input placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm" className="w-full" onClick={create}><Plus className="mr-1 h-4 w-4" />New note</Button>
        {sorted.map((n) => (
          <button key={n.id} onClick={() => setActive(n.id)} className={`w-full rounded-lg p-2 text-left ${note?.id === n.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
            <p className="truncate text-sm font-medium">{n.title || 'Untitled'}</p>
            <p className="text-xs text-muted-foreground">{format(n.updated, 'd MMM, HH:mm')}</p>
          </button>
        ))}
      </Card>
      {!note ? <Empty>Create a note. It saves automatically.</Empty> : (
        <Card className="space-y-3">
          <div className="flex gap-2">
            <Input value={note.title} onChange={(e) => upd({ title: e.target.value })} className="text-lg font-semibold" />
            <Button variant="ghost" size="icon" onClick={() => { setNotes(notes.filter((n) => n.id !== note.id)); setActive(null); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <Textarea value={note.body} onChange={(e) => upd({ body: e.target.value })} className="min-h-[420px]" placeholder="Start typing…" />
          <p className="text-xs text-muted-foreground">{note.body.trim().split(/\s+/).filter(Boolean).length} words · saved</p>
        </Card>
      )}
    </div>
  );
}
