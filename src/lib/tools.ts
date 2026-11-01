import type { LucideIcon } from 'lucide-react';
import {
  Merge, Scissors, Images, LayoutGrid, Hash, Droplets, Eraser, Stamp, PenLine, FileImage, Minimize2, LockOpen, Lock,
  FileText, FileType2, FileOutput, BookOpen, Code2, BookMarked, Quote, ListOrdered, GraduationCap, CalendarCheck,
  ClipboardList, Timer, CalendarDays, Layers, StickyNote, ImageDown, RefreshCw, Brush, Signature, QrCode, UserSquare,
  Wand2, Braces, Regex, KeyRound, GitCompare, Type, CaseSensitive, PencilRuler,
} from 'lucide-react';

export const CATEGORIES = ['PDF', 'Documents', 'Practical File', 'Study', 'Images', 'Code', 'Text'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Tool = {
  id: string;
  name: string;
  desc: string;
  category: Category;
  icon: LucideIcon;
  keywords?: string;
  related?: string[];
};

export const TOOLS: Tool[] = [
  { id: 'pdf-image-editor', name: 'PDF & Image Editor', desc: 'Edit text with matched colour, draw, whiteout, add images', category: 'PDF', icon: PencilRuler, keywords: 'edit modify change text color match whiteout annotate draw image photo' },
  { id: 'merge-pdf', name: 'Merge PDF', desc: 'Combine PDFs and images into one file', category: 'PDF', icon: Merge, keywords: 'join combine' },
  { id: 'split-pdf', name: 'Split PDF', desc: 'Extract page ranges or every page', category: 'PDF', icon: Scissors, keywords: 'extract separate' },
  { id: 'images-to-pdf', name: 'Images to PDF', desc: 'Photos & screenshots to one PDF', category: 'PDF', icon: Images, keywords: 'jpg png photo convert' },
  { id: 'organize-pdf', name: 'Organize Pages', desc: 'Reorder, rotate and delete pages', category: 'PDF', icon: LayoutGrid, keywords: 'rotate delete reorder sort' },
  { id: 'page-numbers', name: 'Add Page Numbers', desc: 'Number every page', category: 'PDF', icon: Hash },
  { id: 'watermark-pdf', name: 'Watermark PDF', desc: 'Stamp text across pages', category: 'PDF', icon: Droplets },
  { id: 'watermark-remover-pdf', name: 'PDF Watermark Remover', desc: 'Strip watermark layers from your PDFs', category: 'PDF', icon: Eraser, keywords: 'remove clean' },
  { id: 'stamp-pdf', name: 'Stamp PDF', desc: 'Place your saved stamps on pages', category: 'PDF', icon: Stamp, keywords: 'seal approve' },
  { id: 'sign-pdf', name: 'Sign PDF', desc: 'Draw or type a signature', category: 'PDF', icon: PenLine, keywords: 'signature esign' },
  { id: 'pdf-to-images', name: 'PDF to Images', desc: 'Export pages as PNG or JPG', category: 'PDF', icon: FileImage, keywords: 'jpg png convert' },
  { id: 'compress-pdf', name: 'Compress PDF', desc: 'Shrink file size for portals', category: 'PDF', icon: Minimize2, keywords: 'reduce size smaller' },
  { id: 'unlock-pdf', name: 'Unlock PDF', desc: 'Remove a password you know', category: 'PDF', icon: LockOpen, keywords: 'password decrypt' },
  { id: 'protect-pdf', name: 'Protect PDF', desc: 'Add a password to a PDF', category: 'PDF', icon: Lock, keywords: 'password encrypt secure' },
  { id: 'word-to-pdf', name: 'Word to PDF', desc: 'Convert DOCX files to PDF', category: 'Documents', icon: FileText, keywords: 'docx doc convert' },
  { id: 'pdf-to-word', name: 'PDF to Word', desc: 'Editable DOCX from a PDF', category: 'Documents', icon: FileType2, keywords: 'docx convert edit' },
  { id: 'pdf-to-text', name: 'PDF to Text', desc: 'Copy all text out of a PDF', category: 'Documents', icon: FileOutput, keywords: 'extract txt' },
  { id: 'practical-file', name: 'Practical File Builder', desc: 'Lab file with cover, index & experiments', category: 'Practical File', icon: BookOpen, keywords: 'lab record experiment' },
  { id: 'code-to-pdf', name: 'Code to PDF', desc: 'Programs with line numbers, print-ready', category: 'Practical File', icon: Code2, keywords: 'program print' },
  { id: 'cover-page', name: 'Cover Page Maker', desc: 'Assignment & project front pages', category: 'Practical File', icon: BookMarked, keywords: 'front title' },
  { id: 'citation', name: 'Citation Generator', desc: 'APA, MLA & IEEE references', category: 'Practical File', icon: Quote, keywords: 'reference bibliography' },
  { id: 'index-page', name: 'Index Page Maker', desc: 'Contents table for your file', category: 'Practical File', icon: ListOrdered, keywords: 'contents table' },
  { id: 'cgpa', name: 'CGPA Calculator', desc: 'SGPA per semester and overall CGPA', category: 'Study', icon: GraduationCap, keywords: 'sgpa gpa grades percentage' },
  { id: 'attendance', name: 'Attendance Calculator', desc: 'How many you can skip or must attend', category: 'Study', icon: CalendarCheck, keywords: 'bunk 75' },
  { id: 'assignments', name: 'Assignment Tracker', desc: 'Deadlines, subjects and progress', category: 'Study', icon: ClipboardList, keywords: 'deadline todo homework' },
  { id: 'pomodoro', name: 'Pomodoro Timer', desc: 'Focus sessions with a streak', category: 'Study', icon: Timer, keywords: 'focus timer' },
  { id: 'timetable', name: 'Timetable Maker', desc: 'Weekly class schedule', category: 'Study', icon: CalendarDays, keywords: 'schedule class' },
  { id: 'flashcards', name: 'Flashcards', desc: 'Decks you can flip and revise', category: 'Study', icon: Layers, keywords: 'revise memorize' },
  { id: 'notes', name: 'Quick Notes', desc: 'Autosaving notes', category: 'Study', icon: StickyNote },
  { id: 'image-compressor', name: 'Image Compressor & Resizer', desc: 'Shrink photos for upload limits', category: 'Images', icon: ImageDown, keywords: 'resize reduce kb' },
  { id: 'image-converter', name: 'Image Converter', desc: 'PNG, JPG and WEBP', category: 'Images', icon: RefreshCw, keywords: 'convert format' },
  { id: 'image-watermark-remover', name: 'Image Watermark Remover', desc: 'Brush over marks to erase them', category: 'Images', icon: Brush, keywords: 'remove erase clean' },
  { id: 'stamp-studio', name: 'Stamp Studio', desc: 'Design seals & stamps, place them anywhere', category: 'Images', icon: Stamp, keywords: 'seal stamp maker' },
  { id: 'signature-maker', name: 'Signature Maker', desc: 'Transparent PNG signature', category: 'Images', icon: Signature, keywords: 'sign' },
  { id: 'qr-code', name: 'QR Code Generator', desc: 'Links, text and Wi-Fi QR codes', category: 'Images', icon: QrCode },
  { id: 'passport-photo', name: 'Passport Photo Maker', desc: 'Crop to size and print a sheet', category: 'Images', icon: UserSquare, keywords: 'id photo' },
  { id: 'background-remover', name: 'Background Remover', desc: 'Remove plain backgrounds', category: 'Images', icon: Wand2, keywords: 'transparent' },
  { id: 'json-formatter', name: 'JSON Formatter', desc: 'Beautify, minify and validate', category: 'Code', icon: Braces },
  { id: 'regex-tester', name: 'Regex Tester', desc: 'Live matches and groups', category: 'Code', icon: Regex },
  { id: 'password-generator', name: 'Password Generator', desc: 'Strong random passwords', category: 'Code', icon: KeyRound },
  { id: 'text-compare', name: 'Text Compare', desc: 'Line-by-line differences', category: 'Text', icon: GitCompare, keywords: 'diff' },
  { id: 'word-counter', name: 'Word Counter', desc: 'Words, characters, reading time', category: 'Text', icon: Type },
  { id: 'case-converter', name: 'Case Converter', desc: 'UPPER, lower, Title, camelCase', category: 'Text', icon: CaseSensitive },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);

const RELATED: Record<string, string[]> = {
  'merge-pdf': ['organize-pdf', 'compress-pdf', 'page-numbers'],
  'images-to-pdf': ['image-compressor', 'merge-pdf', 'compress-pdf'],
  'stamp-pdf': ['stamp-studio', 'sign-pdf', 'watermark-pdf'],
  'stamp-studio': ['stamp-pdf', 'signature-maker', 'sign-pdf'],
  'sign-pdf': ['signature-maker', 'stamp-pdf', 'merge-pdf'],
  'practical-file': ['code-to-pdf', 'cover-page', 'index-page'],
  'attendance': ['cgpa', 'timetable', 'assignments'],
};

export function relatedTools(t: Tool) {
  const ids = RELATED[t.id] ?? TOOLS.filter((x) => x.category === t.category && x.id !== t.id).map((x) => x.id);
  return ids.slice(0, 3).map(toolById).filter(Boolean) as Tool[];
}

export function searchTools(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return TOOLS;
  const terms = s.split(/\s+/);
  return TOOLS.filter((t) => {
    const hay = `${t.name} ${t.desc} ${t.category} ${t.keywords ?? ''}`.toLowerCase();
    return terms.every((x) => hay.includes(x));
  });
}
