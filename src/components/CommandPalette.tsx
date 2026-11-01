import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Search, LayoutDashboard, Home } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@project/components/ui/dialog';
import { TOOLS, CATEGORIES, type Tool } from '../lib/tools';
import { useRecent } from '../lib/usage';

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return { open, setOpen };
}

const itemCls = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-secondary aria-selected:text-secondary-foreground';

export default function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const nav = useNavigate();
  const { recent } = useRecent();
  const go = (path: string) => {
    setOpen(false);
    nav(path);
  };
  const recentTools = recent.map((r) => TOOLS.find((t) => t.id === r.id)).filter((t): t is Tool => !!t).slice(0, 4);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Jump to a tool</DialogTitle>
        <Command loop className="flex flex-col">
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input autoFocus placeholder="Jump to a tool…" className="h-12 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="p-6 text-center text-sm text-muted-foreground">No tools found.</Command.Empty>
            <Command.Group heading="Pages" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
              <Command.Item className={itemCls} onSelect={() => go('/')}><Home className="h-4 w-4" />Home</Command.Item>
              <Command.Item className={itemCls} onSelect={() => go('/semester')}><LayoutDashboard className="h-4 w-4" />My Semester</Command.Item>
            </Command.Group>
            {recentTools.length > 0 && (
              <Command.Group heading="Recent" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                {recentTools.map((t) => (
                  <Command.Item key={'r' + t.id} value={`recent ${t.name}`} className={itemCls} onSelect={() => go(`/tools/${t.id}`)}>
                    <t.icon className="h-4 w-4 text-primary" /><span className="text-foreground">{t.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {CATEGORIES.map((c) => (
              <Command.Group key={c} heading={c} className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                {TOOLS.filter((t) => t.category === c).map((t) => (
                  <Command.Item key={t.id} value={`${t.name} ${t.desc} ${t.keywords ?? ''}`} className={itemCls} onSelect={() => go(`/tools/${t.id}`)}>
                    <t.icon className="h-4 w-4 text-primary" />
                    <span className="text-foreground">{t.name}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{t.desc}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
