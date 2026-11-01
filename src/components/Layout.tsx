import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Search, Cloud, CloudOff, Loader2, LogOut, Check, Menu } from 'lucide-react';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { Button } from '@project/components/ui/button';
import { Toaster } from '@project/components/ui/sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@project/components/ui/sheet';
import CommandPalette, { useCommandPalette } from './CommandPalette';
import { useSync, type SyncStatus } from '../lib/sync';
import { useStored } from '../lib/storage';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        S<span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent ring-2 ring-background" />
      </span>
      StudentKit<span className="text-primary">Pro+</span>
    </Link>
  );
}

function SyncIcon({ s }: { s: SyncStatus }) {
  if (s === 'syncing') return <Loader2 className="h-4 w-4 animate-spin" />;
  if (s === 'error') return <CloudOff className="h-4 w-4 text-destructive" />;
  return <Cloud className="h-4 w-4 text-primary" />;
}

function Account() {
  const { user, isLoading } = useAuth();
  const status = useSync(user?.id ?? null);
  if (isLoading) return null;
  if (!user)
    return (
      <Button variant="outline" size="sm" onClick={() => loginWithRedirect()}>
        <Cloud className="mr-1.5 h-4 w-4" />Sign in to sync
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SyncIcon s={status} />
          <span className="hidden max-w-[120px] truncate sm:inline">{user.firstName || user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{user.email}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {status === 'synced' && <><Check className="h-3 w-3" />Synced across your devices</>}
            {status === 'syncing' && 'Syncing…'}
            {status === 'error' && 'Sync failed. Your data is still saved on this device.'}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/semester">My Semester</Link></DropdownMenuItem>
        <DropdownMenuItem onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const navCls = ({ isActive }: { isActive: boolean }) => `rounded-md px-3 py-1.5 text-sm transition ${isActive ? 'bg-secondary font-semibold text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}`;

export default function Layout() {
  const { open, setOpen } = useCommandPalette();
  const [theme, setTheme] = useStored<'light' | 'dark'>('theme', 'light');
  const [mobile, setMobile] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
    setMobile(false);
  }, [loc.pathname]);
  const links = (
    <>
      <NavLink to="/" end className={navCls}>Tools</NavLink>
      <NavLink to="/semester" className={navCls}>My Semester</NavLink>
      <NavLink to="/tools/stamp-studio" className={navCls}>Stamp Studio</NavLink>
      <NavLink to="/tools/pdf-image-editor" className={navCls}>Editor</NavLink>
      <NavLink to="/source" className={navCls}>Source Code</NavLink>
    </>
  );
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center gap-3 px-4">
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 md:flex">{links}</nav>
          <button onClick={() => setOpen(true)} className="ml-auto hidden h-9 w-64 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition hover:border-primary/50 lg:flex">
            <Search className="h-4 w-4" />Jump to a tool…<kbd className="ml-auto rounded bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <Button size="icon" variant="ghost" className="ml-auto lg:hidden" onClick={() => setOpen(true)} aria-label="Search"><Search className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Account />
          <Sheet open={mobile} onOpenChange={setMobile}>
            <SheetTrigger asChild><Button size="icon" variant="ghost" className="md:hidden" aria-label="Menu"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="mb-4">Menu</SheetTitle>
              <nav className="flex flex-col gap-1">{links}</nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="flex-1">
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        StudentKit Pro+ · Free tools for students · Files are processed on your device
      </footer>
      <CommandPalette open={open} setOpen={setOpen} />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
