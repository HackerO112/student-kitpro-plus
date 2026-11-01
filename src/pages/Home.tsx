import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { Search, Star, ShieldCheck, Zap, Cloud, ArrowRight } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { CATEGORIES, TOOLS, searchTools, toolById, type Category, type Tool } from '../lib/tools';
import { usePinned, useRecent } from '../lib/usage';

export function ToolCard({ t, note }: { t: Tool; note?: string }) {
  const { pinned, toggle } = usePinned();
  const on = pinned.includes(t.id);
  return (
    <div className="group relative">
      <Link to={`/tools/${t.id}`} className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
          <t.icon className="h-5 w-5" />
        </span>
        <p className="pr-6 font-semibold leading-tight">{t.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{note ?? t.desc}</p>
      </Link>
      <button onClick={() => toggle(t.id)} aria-label={on ? 'Unpin' : 'Pin'} className={cn('absolute right-3 top-3 rounded-md p-1 transition', on ? 'text-accent-foreground' : 'text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100')}>
        <Star className={cn('h-4 w-4', on && 'fill-current')} style={on ? { color: 'hsl(45 95% 50%)' } : undefined} />
      </button>
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;

export default function Home() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'All'>('All');
  const { pinned } = usePinned();
  const { recent } = useRecent();
  const results = useMemo(() => searchTools(q).filter((t) => cat === 'All' || t.category === cat), [q, cat]);
  const quick = useMemo(() => {
    const seen = new Set<string>();
    const list: { t: Tool; note: string }[] = [];
    pinned.forEach((id) => { const t = toolById(id); if (t && !seen.has(id)) { seen.add(id); list.push({ t, note: 'Pinned' }); } });
    recent.forEach((r) => { const t = toolById(r.id); if (t && !seen.has(r.id)) { seen.add(r.id); list.push({ t, note: `Used ${formatDistanceToNowStrict(r.at)} ago` }); } });
    return list.slice(0, 8);
  }, [pinned, recent]);
  const filtering = q.trim() || cat !== 'All';

  return (
    <div>
      <section className="relative overflow-hidden border-b bg-muted/60">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="container relative mx-auto px-4 py-14 md:py-20">
          <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            {TOOLS.length} free tools · files stay on your device · no sign-up
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] md:text-6xl">
            Finish practicals & projects in <span className="relative whitespace-nowrap"><span className="relative z-10">minutes</span><span className="absolute inset-x-0 bottom-1 -z-0 h-3 bg-accent md:h-4" /></span>, not nights.
          </motion.h1>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-8 flex max-w-2xl items-center gap-3 rounded-xl border bg-card px-4 shadow-md focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Try "merge pdf", "attendance", "stamp"' className="h-14 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground" />
          </motion.div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(['All', ...CATEGORIES] as const).map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn('rounded-lg border px-3 py-1.5 text-sm transition', cat === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>{c}</button>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Private by design</span>
            <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />Instant, no uploads</span>
            <span className="flex items-center gap-2"><Cloud className="h-4 w-4 text-primary" />Optional sync</span>
          </div>
        </div>
      </section>

      <div className="container mx-auto space-y-12 px-4 py-10">
        {filtering ? (
          <section>
            <h2 className="mb-4 text-lg font-bold">{results.length} tool{results.length === 1 ? '' : 's'}</h2>
            {results.length ? <Grid>{results.map((t) => <ToolCard key={t.id} t={t} />)}</Grid> : <p className="text-muted-foreground">No tools match "{q}".</p>}
          </section>
        ) : (
          <>
            {quick.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-bold">Pinned & recent</h2>
                <Grid>{quick.map(({ t, note }) => <ToolCard key={t.id} t={t} note={note} />)}</Grid>
              </section>
            )}
            <Link to="/semester" className="group flex items-center justify-between rounded-2xl border bg-primary p-6 text-primary-foreground shadow-md transition hover:shadow-lg">
              <div>
                <p className="text-xl font-bold">My Semester dashboard</p>
                <p className="text-sm opacity-85">Attendance, CGPA, deadlines, timetable and focus streak in one place.</p>
              </div>
              <ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" />
            </Link>
            {CATEGORIES.map((c) => {
              const list = TOOLS.filter((t) => t.category === c);
              return (
                <section key={c} id={c}>
                  <h2 className="mb-4 flex items-baseline gap-2 text-lg font-bold">{c}<span className="text-sm font-normal text-muted-foreground">{list.length} tools</span></h2>
                  <Grid>{list.map((t) => <ToolCard key={t.id} t={t} />)}</Grid>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
