import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { toast } from 'sonner';
import { Download, Upload, ArrowUpRight } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Progress } from '@project/components/ui/progress';
import { DAYS, attendanceStats, cgpaOf, streakOf, useAttendance, useCgpa, usePomodoro, useTasks, useTimetable } from '../tools/study';
import { exportAll, importAll } from '../lib/storage';
import { download } from '../lib/files';

function Stat({ label, value, sub, to }: { label: string; value: string; sub: string; to: string }) {
  return (
    <Link to={to} className="group rounded-xl border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md">
      <p className="flex items-center justify-between text-sm text-muted-foreground">{label}<ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </Link>
  );
}

function Panel({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between"><p className="font-semibold">{title}</p><Link to={to} className="text-sm text-primary hover:underline">Open</Link></div>
      {children}
    </div>
  );
}

export default function Semester() {
  const [att] = useAttendance();
  const [cg] = useCgpa();
  const [tasks] = useTasks();
  const [pomo] = usePomodoro();
  const [slots] = useTimetable();
  const fileRef = useRef<HTMLInputElement>(null);
  const a = attendanceStats(att);
  const open = tasks.filter((t) => !t.done).sort((x, y) => x.due.localeCompare(y.due));
  const week = open.filter((t) => differenceInCalendarDays(parseISO(t.due), new Date()) <= 7);
  const today = (new Date().getDay() + 6) % 7;
  const todaySlots = slots.filter((s) => s.day === today).sort((x, y) => x.start.localeCompare(y.start));
  const weekAgo = subDays(new Date(), 7).toISOString();
  const weekPomos = pomo.sessions.filter((s) => s >= weekAgo).length;

  const backup = () => download(new Blob([JSON.stringify({ app: 'studentkit-pro', exportedAt: Date.now(), data: exportAll() }, null, 2)], { type: 'application/json' }), `studentkit-backup-${format(new Date(), 'yyyy-MM-dd')}.json`);
  const restore = async (f?: File) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j.data || typeof j.data !== 'object') throw new Error();
      importAll(j.data);
      toast.success('Backup restored');
    } catch {
      toast.error("That file isn't a StudentKit backup");
    }
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">My semester</h1>
          <p className="text-muted-foreground">{format(new Date(), 'EEEE, d MMMM')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={backup}><Download className="mr-1.5 h-4 w-4" />Back up</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1.5 h-4 w-4" />Restore</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat to="/tools/attendance" label="Attendance" value={att.subjects.length ? `${a.pct.toFixed(0)}%` : '—'} sub={!att.subjects.length ? 'Add your subjects' : a.need ? `Attend ${a.need} more to hit ${att.target}%` : `Can skip ${a.canSkip} lectures`} />
        <Stat to="/tools/cgpa" label="CGPA" value={cg.semesters.length ? cgpaOf(cg.semesters).toFixed(2) : '—'} sub={cg.semesters.length ? `After ${cg.semesters.length} semester(s)` : 'Add your semesters'} />
        <Stat to="/tools/assignments" label="Due this week" value={String(week.length)} sub={open[0] ? `Next: ${open[0].title}, ${format(parseISO(open[0].due), 'EEE')}` : 'All caught up'} />
        <Stat to="/tools/pomodoro" label="Focus streak" value={`${streakOf(pomo.sessions)} day${streakOf(pomo.sessions) === 1 ? '' : 's'}`} sub={`${weekPomos} pomodoros this week`} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Upcoming deadlines" to="/tools/assignments">
          {!open.length ? <p className="text-sm text-muted-foreground">No pending assignments.</p> : (
            <div className="space-y-2 text-sm">
              {open.slice(0, 6).map((t) => {
                const d = differenceInCalendarDays(parseISO(t.due), new Date());
                return <div key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.title}</span><span className={d < 0 ? 'text-destructive' : 'text-muted-foreground'}>{format(parseISO(t.due), 'MMM d')}</span></div>;
              })}
            </div>
          )}
        </Panel>
        <Panel title={`Today's timetable (${DAYS[today]})`} to="/tools/timetable">
          {!todaySlots.length ? <p className="text-sm text-muted-foreground">No classes today.</p> : (
            <div className="space-y-2 text-sm">
              {todaySlots.map((s) => <div key={s.id} className="flex justify-between"><span><span className="font-mono text-xs text-muted-foreground">{s.start}</span> {s.subject}</span><span className="text-muted-foreground">{s.room}</span></div>)}
            </div>
          )}
        </Panel>
        <Panel title="Attendance by subject" to="/tools/attendance">
          {!att.subjects.length ? <p className="text-sm text-muted-foreground">No subjects yet.</p> : (
            <div className="space-y-3 text-sm">
              {att.subjects.map((s) => {
                const p = s.total ? (s.attended / s.total) * 100 : 0;
                return <div key={s.id}><div className="mb-1 flex justify-between"><span>{s.name}</span><span className={p < att.target ? 'text-destructive' : ''}>{p.toFixed(0)}%</span></div><Progress value={p} className="h-1.5" /></div>;
              })}
            </div>
          )}
        </Panel>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Everything here is saved on this device. Sign in to sync it across your devices, or use Back up to keep a copy.</p>
    </div>
  );
}
