import { Suspense, useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { ChevronRight, Star } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { relatedTools, toolById } from '../lib/tools';
import { usePinned, useRecent } from '../lib/usage';
import { TOOL_COMPONENTS } from '../tools/registry';
import { ToolCard } from './Home';

function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="h-64 lg:col-span-2" />
      <Skeleton className="h-64" />
    </div>
  );
}

export default function ToolPage() {
  const { id = '' } = useParams();
  const tool = toolById(id);
  const { pinned, toggle } = usePinned();
  const { touch } = useRecent();
  useEffect(() => {
    if (tool) {
      touch(tool.id);
      document.title = `${tool.name} · StudentKit Pro+`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.id]);
  if (!tool) return <Navigate to="/" replace />;
  const Comp = TOOL_COMPONENTS[tool.id];
  const on = pinned.includes(tool.id);
  return (
    <div>
      <div className="border-b">
        <div className="container mx-auto flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/#${tool.category}`} className="hover:text-foreground">{tool.category}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">{tool.name}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => toggle(tool.id)}>
            <Star className={cn('mr-1 h-4 w-4', on && 'fill-current')} style={on ? { color: 'hsl(45 95% 50%)' } : undefined} />
            {on ? 'Pinned' : 'Pin'}
          </Button>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><tool.icon className="h-6 w-6" /></span>
          <div>
            <h1 className="text-2xl font-extrabold md:text-3xl">{tool.name}</h1>
            <p className="text-muted-foreground">{tool.desc}</p>
          </div>
        </div>
        <ErrorBoundary resetKeys={[tool.id]} fallbackRender={({ resetErrorBoundary }) => (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">Something went wrong in this tool. <button className="font-semibold underline" onClick={resetErrorBoundary}>Try again</button></div>
        )}>
          <Suspense fallback={<Loading />}>
            <Comp />
          </Suspense>
        </ErrorBoundary>
        <section className="mt-14">
          <h2 className="mb-4 text-lg font-bold">Related tools</h2>
          <div className="grid gap-3 sm:grid-cols-3">{relatedTools(tool).map((t) => <ToolCard key={t.id} t={t} />)}</div>
        </section>
      </div>
    </div>
  );
}
