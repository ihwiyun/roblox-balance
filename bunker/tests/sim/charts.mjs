// Charts for the balance checkpoint: SVG drawn into an HTML page and captured as PNG with Playwright.
// Colors are the categorical slots in fixed order (one per pay profile, never cycled); text stays in ink tokens.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#8a8984', grid: '#e6e5e1', surface: '#fcfcfb' };
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const PROFILE_COLOR = { f2p: SERIES[0], light: SERIES[1], heavy: SERIES[2], whale: SERIES[3] };
export const PROFILE_NAME = { f2p: '무과금', light: '소과금', heavy: '고과금', whale: '초고과금' };
export const BOT_NAME = { human: '사람형 봇', greedy: '최적 봇' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const nice = (max, n = 5) => { const raw = max / n, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
const fmt = v => (Math.abs(v) >= 1e4 ? v.toExponential(0).replace('e+', 'e') : Number.isInteger(v) ? String(v) : v.toFixed(1));

// one panel of a line chart; series: [{ name, color, points: [[x, y]], dash }]
function linePanel({ x0, y0, w, h, title, series, xMax, yMax, xLabel, yLabel, refs = [], bands = [], logY = false, yMin = 1 }) {
  const xs = nice(xMax), ys = logY ? null : nice(yMax);
  const X = x => x0 + (x / xMax) * w;
  const Y = logY ? y => y0 + h - (Math.log10(Math.max(y, yMin)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)) * h : y => y0 + h - (y / yMax) * h;
  let g = `<text x="${x0}" y="${y0 - 14}" font-size="15" font-weight="700" fill="${INK.primary}">${esc(title)}</text>`;
  for (const b of bands) g += `<rect x="${X(b.x1)}" y="${Y(b.y2)}" width="${X(b.x2) - X(b.x1)}" height="${Y(b.y1) - Y(b.y2)}" fill="${b.fill || '#f0efec'}"/>` +
    `<text x="${X(b.x2) + 4}" y="${Y(b.y2) + 12}" font-size="11" fill="${INK.secondary}">${esc(b.label || '')}</text>`;
  if (logY) for (let e = Math.ceil(Math.log10(yMin)); e <= Math.log10(yMax); e++) {
    const v = 10 ** e;
    g += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(v)}" y2="${Y(v)}" stroke="${INK.grid}"/><text x="${x0 - 8}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="${INK.muted}">${fmt(v)}</text>`;
  } else for (let v = 0; v <= yMax + 1e-9; v += ys) g += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(v)}" y2="${Y(v)}" stroke="${INK.grid}"/><text x="${x0 - 8}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="${INK.muted}">${fmt(v)}</text>`;
  for (let v = 0; v <= xMax + 1e-9; v += xs) g += `<text x="${X(v)}" y="${y0 + h + 18}" font-size="11" text-anchor="middle" fill="${INK.muted}">${fmt(v)}</text>`;
  g += `<line x1="${x0}" x2="${x0 + w}" y1="${y0 + h}" y2="${y0 + h}" stroke="${INK.secondary}"/>`;
  for (const r of refs) g += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="${INK.secondary}" stroke-dasharray="3 4"/><text x="${x0 + w}" y="${Y(r.y) - 5}" font-size="11" text-anchor="end" fill="${INK.secondary}">${esc(r.label)}</text>`;
  g += `<text x="${x0 + w / 2}" y="${y0 + h + 40}" font-size="12" text-anchor="middle" fill="${INK.secondary}">${esc(xLabel)}</text>`;
  g += `<text transform="translate(${x0 - 46},${y0 + h / 2}) rotate(-90)" font-size="12" text-anchor="middle" fill="${INK.secondary}">${esc(yLabel)}</text>`;
  const ends = [];
  for (const s of series) {
    if (!s.points.length) continue;
    const d = s.points.map(([x, y], i) => `${i ? 'L' : 'M'}${X(Math.min(x, xMax)).toFixed(1)},${Y(Math.min(y, yMax)).toFixed(1)}`).join('');
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} opacity="${s.opacity ?? 1}"/>`;
    const [lx, ly] = s.points[s.points.length - 1];
    if (s.label !== false) ends.push({ x: X(Math.min(lx, xMax)), y: Y(Math.min(ly, yMax)), name: s.label || s.name, color: s.color });
  }
  // end labels: the dot stays on the line's end, only the text is nudged apart (with a short leader)
  ends.sort((a, b) => a.y - b.y);
  ends.forEach((e, i) => { e.ty = i && e.y - ends[i - 1].ty < 15 ? ends[i - 1].ty + 15 : e.y; });
  for (const e of ends) g += `<circle cx="${e.x}" cy="${e.y}" r="4" fill="${e.color}" stroke="${INK.surface}" stroke-width="2"/>` +
    (e.ty !== e.y ? `<line x1="${e.x + 4}" y1="${e.y}" x2="${e.x + 10}" y2="${e.ty}" stroke="${INK.muted}"/>` : '') +
    `<text x="${e.x + 12}" y="${e.ty + 4}" font-size="11" fill="${INK.primary}">${esc(e.name)}</text>`;
  return g;
}

export function legend(items, x, y) {
  let g = '', cx = x;
  for (const it of items) {
    g += `<line x1="${cx}" x2="${cx + 22}" y1="${y}" y2="${y}" stroke="${it.color}" stroke-width="3"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''}/><text x="${cx + 28}" y="${y + 4}" font-size="12" fill="${INK.primary}">${esc(it.name)}</text>`;
    cx += 40 + it.name.length * 13;
  }
  return g;
}

// a figure: title, subtitle, legend and a grid of line panels
export function lineFigure({ title, subtitle, legendItems = [], panels, cols = panels.length, width = 1200, panelH = 420, notes = [] }) {
  const padL = 80, padR = 120, gap = 150, top = 110;
  const rows = Math.ceil(panels.length / cols), pw = (width - padL - padR - gap * (cols - 1)) / cols;
  const height = top + rows * (panelH + 90) + notes.length * 18 + 20;
  let g = `<rect width="${width}" height="${height}" fill="${INK.surface}"/>`;
  g += `<text x="${padL - 50}" y="36" font-size="22" font-weight="700" fill="${INK.primary}">${esc(title)}</text>`;
  if (subtitle) g += `<text x="${padL - 50}" y="60" font-size="13" fill="${INK.secondary}">${esc(subtitle)}</text>`;
  g += legend(legendItems, padL - 50, 86);
  panels.forEach((p, i) => { const c = i % cols, r = Math.floor(i / cols); g += linePanel({ ...p, x0: padL + c * (pw + gap), y0: top + 30 + r * (panelH + 90), w: pw, h: panelH - 40 }); });
  notes.forEach((n, i) => { g += `<text x="${padL - 50}" y="${height - 14 - (notes.length - 1 - i) * 18}" font-size="11" fill="${INK.secondary}">${esc(n)}</text>`; });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="'WenQuanYi Zen Hei', sans-serif">${g}</svg>`, width, height };
}

// horizontal bars: rows [{ label, value, color, note }] against an optional limit line
export function barFigure({ title, subtitle, rows, unit = '%', limit, limitLabel, width = 1200, max }) {
  const top = 90, rowH = 30, padL = 230, padR = 160, w = width - padL - padR;
  const height = top + rows.length * rowH + 70;
  const vmax = max || Math.max(limit || 0, ...rows.map(r => r.value)) * 1.1 || 1;
  const X = v => padL + (v / vmax) * w;
  let g = `<rect width="${width}" height="${height}" fill="${INK.surface}"/>`;
  g += `<text x="30" y="36" font-size="22" font-weight="700" fill="${INK.primary}">${esc(title)}</text>`;
  if (subtitle) g += `<text x="30" y="60" font-size="13" fill="${INK.secondary}">${esc(subtitle)}</text>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    if (r.group) { g += `<text x="30" y="${y + 18}" font-size="13" font-weight="700" fill="${INK.primary}">${esc(r.group)}</text>`; return; }
    g += `<text x="${padL - 10}" y="${y + 18}" font-size="12" text-anchor="end" fill="${INK.primary}">${esc(r.label)}</text>`;
    const bw = Math.max(2, X(Math.min(r.value, vmax)) - padL);
    g += `<rect x="${padL}" y="${y + 6}" width="${bw}" height="${rowH - 12}" rx="4" fill="${r.color || SERIES[0]}"/>`;
    g += `<text x="${padL + bw + 8}" y="${y + 19}" font-size="12" fill="${INK.primary}">${esc(r.text ?? (r.value.toFixed(1) + unit))}</text>`;
  });
  if (limit != null) g += `<line x1="${X(limit)}" x2="${X(limit)}" y1="${top}" y2="${top + rows.length * rowH}" stroke="${INK.secondary}" stroke-dasharray="3 4"/><text x="${X(limit) + 4}" y="${top - 6}" font-size="11" fill="${INK.secondary}">${esc(limitLabel || '')}</text>`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="'WenQuanYi Zen Hei', sans-serif">${g}</svg>`, width, height };
}

// stacked horizontal bars in log10 units: rows [{ label, parts: [{ key, value }] }], keys colored in fixed order
export function stackFigure({ title, subtitle, rows, keys, names, width = 1200, notes = [] }) {
  const top = 120, rowH = 54, padL = 150, padR = 60, w = width - padL - padR;
  const height = top + rows.length * rowH + 60 + notes.length * 18;
  const total = Math.max(...rows.map(r => r.parts.reduce((a, p) => a + Math.max(0, p.value), 0)));
  const X = v => (v / total) * w;
  let g = `<rect width="${width}" height="${height}" fill="${INK.surface}"/>`;
  g += `<text x="30" y="36" font-size="22" font-weight="700" fill="${INK.primary}">${esc(title)}</text>`;
  if (subtitle) g += `<text x="30" y="60" font-size="13" fill="${INK.secondary}">${esc(subtitle)}</text>`;
  g += legend(keys.map((k, i) => ({ name: names[k], color: SERIES[i % SERIES.length] })), 30, 92);
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    g += `<text x="${padL - 12}" y="${y + 26}" font-size="13" text-anchor="end" fill="${INK.primary}">${esc(r.label)}</text>`;
    let x = padL;
    keys.forEach((k, j) => {
      const p = r.parts.find(q => q.key === k), v = p ? Math.max(0, p.value) : 0;
      if (v <= 0) return;
      const bw = X(v);
      g += `<rect x="${x}" y="${y + 8}" width="${Math.max(1, bw - 2)}" height="${rowH - 22}" rx="3" fill="${SERIES[j % SERIES.length]}"/>`;
      if (bw > 34) g += `<text x="${x + bw / 2 - 1}" y="${y + 26}" font-size="11" text-anchor="middle" fill="#ffffff">${esc(p.text)}</text>`;
      x += bw;
    });
    g += `<text x="${x + 6}" y="${y + 26}" font-size="11" fill="${INK.secondary}">${esc(r.note || '')}</text>`;
  });
  notes.forEach((n, i) => { g += `<text x="30" y="${height - 14 - (notes.length - 1 - i) * 18}" font-size="11" fill="${INK.secondary}">${esc(n)}</text>`; });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="'WenQuanYi Zen Hei', sans-serif">${g}</svg>`, width, height };
}

export async function savePng(fig, path) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: fig.width, height: fig.height }, deviceScaleFactor: 2 });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:${INK.surface}}</style></head><body>${fig.svg}</body></html>`);
    await page.screenshot({ path, clip: { x: 0, y: 0, width: fig.width, height: fig.height } });
  } finally { await browser.close(); }
}
