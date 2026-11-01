import { format } from 'date-fns';
import { loadImage } from './files';

export type StampShape = 'round' | 'oval' | 'rect' | 'badge' | 'signature';
export type StampConfig = {
  id: string;
  name: string;
  shape: StampShape;
  topText: string;
  bottomText: string;
  centerText: string;
  subText: string;
  icon: 'none' | 'star' | 'check' | 'cross' | 'logo';
  logo?: string;
  showDate: boolean;
  dateFormat: string;
  color: string;
  border: 'single' | 'double' | 'dashed' | 'none';
  borderWidth: number;
  font: 'sans' | 'serif' | 'mono' | 'script';
  textSize: number;
  letterSpacing: number;
  rotation: number;
  ink: boolean;
  opacity: number;
};

export const FONTS: Record<StampConfig['font'], string> = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
  script: "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive",
};

export const STAMP_PRESETS: Omit<StampConfig, 'id'>[] = [
  { name: 'Department seal', shape: 'round', topText: 'DEPARTMENT OF COMPUTER SCIENCE', bottomText: 'ABC INSTITUTE OF TECHNOLOGY', centerText: '', subText: '', icon: 'star', showDate: false, dateFormat: 'dd MMM yyyy', color: '#1d4ed8', border: 'double', borderWidth: 4, font: 'sans', textSize: 22, letterSpacing: 2, rotation: 0, ink: true, opacity: 0.95 },
  { name: 'Approved', shape: 'rect', topText: '', bottomText: '', centerText: 'APPROVED', subText: 'Checked by Faculty', icon: 'none', showDate: true, dateFormat: 'dd MMM yyyy', color: '#15803d', border: 'double', borderWidth: 5, font: 'sans', textSize: 54, letterSpacing: 4, rotation: -8, ink: true, opacity: 0.9 },
  { name: 'Received', shape: 'oval', topText: 'RECEIVED', bottomText: 'OFFICE', centerText: '', subText: '', icon: 'none', showDate: true, dateFormat: 'dd/MM/yyyy', color: '#b91c1c', border: 'single', borderWidth: 5, font: 'serif', textSize: 26, letterSpacing: 3, rotation: 0, ink: true, opacity: 0.9 },
  { name: 'Verified by HOD', shape: 'badge', topText: '', bottomText: '', centerText: 'VERIFIED', subText: 'Head of Department', icon: 'check', showDate: false, dateFormat: 'dd MMM yyyy', color: '#7c2d12', border: 'single', borderWidth: 4, font: 'serif', textSize: 44, letterSpacing: 2, rotation: 0, ink: false, opacity: 1 },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function icon(kind: StampConfig['icon'], cx: number, cy: number, s: number, c: StampConfig) {
  if (kind === 'star') {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? s * 0.4 : s;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${c.color}"/>`;
  }
  if (kind === 'check') return `<path d="M${cx - s} ${cy} l${s * 0.7} ${s * 0.7} l${s * 1.3} -${s * 1.4}" fill="none" stroke="${c.color}" stroke-width="${s * 0.3}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (kind === 'cross') return `<path d="M${cx - s * 0.8} ${cy - s * 0.8} L${cx + s * 0.8} ${cy + s * 0.8} M${cx + s * 0.8} ${cy - s * 0.8} L${cx - s * 0.8} ${cy + s * 0.8}" stroke="${c.color}" stroke-width="${s * 0.3}" stroke-linecap="round"/>`;
  if (kind === 'logo' && c.logo) return `<image href="${c.logo}" x="${cx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" preserveAspectRatio="xMidYMid meet"/>`;
  return '';
}

export function stampSize(c: StampConfig) {
  return c.shape === 'round' ? { w: 400, h: 400 } : c.shape === 'oval' ? { w: 500, h: 340 } : c.shape === 'signature' ? { w: 520, h: 220 } : { w: 540, h: 260 };
}

export function renderStampSvg(c: StampConfig) {
  const { w, h } = stampSize(c);
  const uidp = 's' + Math.random().toString(36).slice(2, 8);
  const font = FONTS[c.font];
  const bw = c.borderWidth;
  const date = c.showDate ? format(new Date(), c.dateFormat || 'dd MMM yyyy') : '';
  const dash = c.border === 'dashed' ? `stroke-dasharray="${bw * 3} ${bw * 2}"` : '';
  const stroke = c.border === 'none' ? 'none' : c.color;
  const t = (x: number, y: number, txt: string, size: number, weight = 700) =>
    txt ? `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="${font}" font-size="${size}" font-weight="${weight}" letter-spacing="${c.letterSpacing}" fill="${c.color}">${esc(txt)}</text>` : '';
  let body = '';
  const cx = w / 2;
  const cy = h / 2;

  if (c.shape === 'round' || c.shape === 'oval') {
    const rx = w / 2 - bw - 6;
    const ry = h / 2 - bw - 6;
    body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${stroke}" stroke-width="${bw}" ${dash}/>`;
    if (c.border === 'double') body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx - bw * 2.5}" ry="${ry - bw * 2.5}" fill="none" stroke="${c.color}" stroke-width="${Math.max(1.5, bw / 2)}"/>`;
    const fs = c.textSize;
    const innerRx = rx - fs * 1.9 - bw * 2;
    const innerRy = ry - fs * 1.9 - bw * 2;
    if (c.shape === 'round') body += `<circle cx="${cx}" cy="${cy}" r="${innerRx}" fill="none" stroke="${c.color}" stroke-width="${Math.max(1.5, bw / 2)}"/>`;
    const trx = rx - bw * 3 - fs * 0.85;
    const try_ = ry - bw * 3 - fs * 0.85;
    const brx = rx - bw * 3 - fs * 0.2;
    const bry = ry - bw * 3 - fs * 0.2;
    body += `<path id="${uidp}t" d="M${cx - trx} ${cy} A${trx} ${try_} 0 0 1 ${cx + trx} ${cy}" fill="none"/>`;
    body += `<path id="${uidp}b" d="M${cx - brx} ${cy} A${brx} ${bry} 0 0 0 ${cx + brx} ${cy}" fill="none"/>`;
    const tp = (id: string, txt: string) =>
      txt ? `<text font-family="${font}" font-size="${fs}" font-weight="700" letter-spacing="${c.letterSpacing}" fill="${c.color}"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(txt)}</textPath></text>` : '';
    body += tp(uidp + 't', c.topText) + tp(uidp + 'b', c.bottomText);
    const centerSize = Math.min(innerRx, innerRy);
    const hasIcon = c.icon !== 'none';
    const lines = [c.centerText, c.subText, date].filter(Boolean);
    if (hasIcon) body += icon(c.icon, cx, lines.length ? cy - centerSize * 0.25 : cy, centerSize * (lines.length ? 0.35 : 0.55), c);
    let y = hasIcon ? cy + centerSize * 0.25 : cy - ((lines.length - 1) * centerSize * 0.28) / 2;
    lines.forEach((ln, i) => {
      body += t(cx, y, ln, i === 0 && ln === c.centerText ? centerSize * 0.32 : centerSize * 0.2, i === 0 ? 800 : 600);
      y += centerSize * 0.32;
    });
  } else if (c.shape === 'signature') {
    body += t(cx, cy - 20, c.centerText || 'Signature', c.textSize * 1.4, 400).replace(`font-family="${font}"`, `font-family="${FONTS.script}"`);
    body += `<line x1="40" x2="${w - 40}" y1="${cy + 30}" y2="${cy + 30}" stroke="${c.color}" stroke-width="${Math.max(1.5, bw / 2)}"/>`;
    body += t(cx, cy + 58, [c.subText, date].filter(Boolean).join(' · '), 20, 600);
  } else {
    const r = c.shape === 'badge' ? 36 : 8;
    const pad = bw + 6;
    body += `<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" rx="${r}" fill="none" stroke="${stroke}" stroke-width="${bw}" ${dash}/>`;
    if (c.border === 'double') body += `<rect x="${pad + bw * 2.5}" y="${pad + bw * 2.5}" width="${w - (pad + bw * 2.5) * 2}" height="${h - (pad + bw * 2.5) * 2}" rx="${Math.max(2, r - bw * 2)}" fill="none" stroke="${c.color}" stroke-width="${Math.max(1.5, bw / 2)}"/>`;
    const hasIcon = c.icon !== 'none';
    const textX = hasIcon ? cx + 40 : cx;
    if (hasIcon) body += icon(c.icon, 90, cy, 42, c);
    const lines = [c.topText, c.centerText, c.subText, c.bottomText, date].filter(Boolean);
    let y = cy - ((lines.length - 1) * 38) / 2;
    lines.forEach((ln) => {
      const main = ln === c.centerText;
      body += t(textX, y, ln, main ? c.textSize : Math.max(16, c.textSize * 0.4), main ? 800 : 600);
      y += main ? Math.max(38, c.textSize * 0.8) : 32;
    });
  }

  const filter = c.ink
    ? `<filter id="${uidp}i" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="c"/><feDisplacementMap in="c" in2="n" scale="2.5"/></filter>`
    : '';
  const rot = c.rotation;
  const diag = Math.ceil(Math.sqrt(w * w + h * h));
  const W = rot ? diag : w;
  const H = rot ? diag : h;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${filter}</defs><g opacity="${c.opacity}" ${c.ink ? `filter="url(#${uidp}i)"` : ''} transform="translate(${(W - w) / 2} ${(H - h) / 2}) rotate(${rot} ${cx} ${cy})">${body}</g></svg>`;
}

export async function stampToPng(c: StampConfig, scale = 2) {
  const svg = renderStampSvg(c);
  const m = svg.match(/width="(\d+)" height="(\d+)"/)!;
  const w = Number(m[1]) * scale;
  const h = Number(m[2]) * scale;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return { png: canvas.toDataURL('image/png'), aspect: h / w };
}
