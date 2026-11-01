import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type Mod = Record<string, unknown>;
const pick = (loader: () => Promise<Mod>, name: string) =>
  lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));

const pdfCore = () => import('./pdfCore');
const pdfMore = () => import('./pdfMore');
const stamps = () => import('./stamps');
const docs = () => import('./docs');
const practical = () => import('./practical');
const study = () => import('./study');
const images = () => import('./images');
const code = () => import('./code');
const editor = () => import('./editor');

export const TOOL_COMPONENTS: Record<string, LazyExoticComponent<ComponentType>> = {
  'pdf-image-editor': pick(editor, 'PdfImageEditor'),
  'merge-pdf': pick(pdfCore, 'MergePdf'),
  'split-pdf': pick(pdfCore, 'SplitPdf'),
  'images-to-pdf': pick(pdfCore, 'ImagesToPdf'),
  'organize-pdf': pick(pdfCore, 'OrganizePdf'),
  'pdf-to-images': pick(pdfCore, 'PdfToImages'),
  'page-numbers': pick(pdfMore, 'PageNumbers'),
  'watermark-pdf': pick(pdfMore, 'WatermarkPdf'),
  'watermark-remover-pdf': pick(pdfMore, 'WatermarkRemoverPdf'),
  'compress-pdf': pick(pdfMore, 'CompressPdf'),
  'unlock-pdf': pick(pdfMore, 'UnlockPdf'),
  'protect-pdf': pick(pdfMore, 'ProtectPdf'),
  'stamp-pdf': pick(stamps, 'StampPdf'),
  'sign-pdf': pick(stamps, 'SignPdf'),
  'stamp-studio': pick(stamps, 'StampStudio'),
  'signature-maker': pick(stamps, 'SignatureMaker'),
  'word-to-pdf': pick(docs, 'WordToPdf'),
  'pdf-to-word': pick(docs, 'PdfToWord'),
  'pdf-to-text': pick(docs, 'PdfToText'),
  'practical-file': pick(practical, 'PracticalFile'),
  'code-to-pdf': pick(practical, 'CodeToPdf'),
  'cover-page': pick(practical, 'CoverPage'),
  citation: pick(practical, 'Citation'),
  'index-page': pick(practical, 'IndexPage'),
  cgpa: pick(study, 'CgpaCalculator'),
  attendance: pick(study, 'AttendanceCalculator'),
  assignments: pick(study, 'AssignmentTracker'),
  pomodoro: pick(study, 'PomodoroTimer'),
  timetable: pick(study, 'TimetableMaker'),
  flashcards: pick(study, 'Flashcards'),
  notes: pick(study, 'QuickNotes'),
  'image-compressor': pick(images, 'ImageCompressor'),
  'image-converter': pick(images, 'ImageConverter'),
  'image-watermark-remover': pick(images, 'ImageWatermarkRemover'),
  'qr-code': pick(images, 'QrCodeGenerator'),
  'passport-photo': pick(images, 'PassportPhoto'),
  'background-remover': pick(images, 'BackgroundRemover'),
  'json-formatter': pick(code, 'JsonFormatter'),
  'regex-tester': pick(code, 'RegexTester'),
  'password-generator': pick(code, 'PasswordGenerator'),
  'text-compare': pick(code, 'TextCompare'),
  'word-counter': pick(code, 'WordCounter'),
  'case-converter': pick(code, 'CaseConverter'),
};
