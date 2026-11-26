// news-image-20261126 — "The World in One Day: Thursday 26 November 2026".
// A newspaper front page drawn from scratch in Node stdlib only: own PNG encoder
// (zlib + CRC32, truecolour RGB, 1024x1024), own 5x7 bitmap font, own vector
// drawing helpers. No network, no assets, no copied code. Deterministic output:
// the same bytes on every run.
//
// Content: 34 stories, every one verified as having happened, or first reported,
// on Thursday 26 November 2026 (sources named per story). A DATE CHECK box lists
// the big 23-25 Nov stories deliberately left out, so the day stays clean.
//
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(w: number, h: number, rgb: Buffer): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: None
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 bits, '#' = ink. Authored for this entry.
const GLYPHS: Record<string, string[]> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '$': ['..#..', '.####', '#.#.#', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##.#.', '....#', '...#.', '..#..', '.#...', '#..##'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '*': ['.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '.####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.####', '....#', '....#', '.###.', '....#', '....#', '.####'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.##.', '#....', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '`': ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#..#', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '#..#.', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '###..', '.#...', '.#...', '.#..#', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '{': ['...##', '..#..', '..#..', '###..', '..#..', '..#..', '...##'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '}': ['##...', '..#..', '..#..', '..###', '..#..', '..#..', '##...'],
  '~': ['.....', '.....', '.#..#', '#.##.', '.....', '.....', '.....'],
  '–': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '·': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.....'],
  '°': ['..#..', '.#.#.', '..#..', '.....', '.....', '.....', '.....'],
};
// Fallback for any glyph not defined above.
const BLANK = ['.....', '.....', '.....', '.....', '.....', '.....', '.....'];

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 232];
const INK: RGB = [22, 22, 22];
const RED: RGB = [178, 32, 44];
const BLUE: RGB = [29, 78, 137];
const GREEN: RGB = [30, 122, 52];
const AMBER: RGB = [176, 104, 0];
const WHITE: RGB = [255, 255, 255];
const CREAM2: RGB = [236, 230, 212];
const RULEC: RGB = [150, 138, 110];
const GREY: RGB = [96, 96, 96];
const OCEAN: RGB = [212, 227, 238];
const LAND: RGB = [146, 170, 143];
const DARK: RGB = [16, 36, 62];

const img = Buffer.alloc(W * H * 3);
function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0];
  img[i + 1] = c[1];
  img[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function strokeRect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const hw = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -hw; x <= hw; x++) setPx(cx + x, cy + y, c);
  }
}
function strokeCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPx(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.floor((rx * Math.sqrt(ry * ry - y * y)) / ry);
    for (let x = -hw; x <= hw; x++) setPx(cx + x, cy + y, c);
  }
}
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) setPx(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- text
function glyph(ch: string): string[] {
  return GLYPHS[ch] ?? BLANK;
}
function textWidth(s: string, scale: number): number {
  // advance = 5*scale + 1 px per character
  return s.length * (5 * scale + 1) - 1;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '#') fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 5 * scale + 1;
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (textWidth(test, scale) <= maxW) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
// Small caps-style badge pill.
function badge(x: number, y: number, label: string, bg: RGB): number {
  const w = textWidth(label, 1) + 12;
  fillRect(x, y, w, 13, bg);
  drawText(x + 6, y + 3, label, 1, WHITE);
  return w;
}

// ---------------------------------------------------------------- content
// All 34 stories verified as 26 November 2026 (event or first report, any zone).
interface Lead {
  n: number;
  region: string;
  badgeLabel: string;
  badgeColor: RGB;
  title: string;
  deck: string;
  source: string;
  art: 'parade' | 'chess' | 'ball' | null;
}

const LEADS_A: Lead[] = [
  {
    n: 1,
    region: 'USA · NEW YORK',
    badgeLabel: 'CONFIRMED',
    badgeColor: GREEN,
    title: "THANKSGIVING: MACY'S 100TH PARADE",
    deck: '100 inflatables, 11,000 marchers, 8:30am ET. Gusts may ground the giants.',
    source: "MACY'S INC. · USA TODAY",
    art: 'parade',
  },
  {
    n: 2,
    region: 'SWITZERLAND · GENEVA',
    badgeLabel: 'CONFIRMED',
    badgeColor: GREEN,
    title: 'CHESS: GAME 3 FOR THE WORLD CROWN',
    deck: 'Sindarov has White vs Gukesh, 15:00 CET. Two draws so far — level 1–1.',
    source: 'FIDE · CHESSBASE',
    art: 'chess',
  },
  {
    n: 3,
    region: 'EUROPE',
    badgeLabel: 'CONFIRMED',
    badgeColor: GREEN,
    title: 'EUROPA LEAGUE: 18 TIES, ONE NIGHT',
    deck: 'Matchday 5 in two windows, 17:45 and 20:00 UTC. Olympiacos host Milan.',
    source: 'UEFA',
    art: 'ball',
  },
];

const LEADS_B: Lead[] = [
  {
    n: 4,
    region: 'USA',
    badgeLabel: 'CONFIRMED',
    badgeColor: GREEN,
    title: '81.5M ON THE MOVE AS STORMS CLOSE IN',
    deck: 'AAA: 81.5M travelling 24–30 Nov. FAA: 417,000 flights forecast.',
    source: 'AAA · FAA',
    art: null,
  },
  {
    n: 5,
    region: 'USA',
    badgeLabel: 'CONFIRMED',
    badgeColor: GREEN,
    title: 'NFL: THREE GAMES, ONE TABLE',
    deck: 'Bears at Lions 1pm, Eagles at Cowboys 4:30pm, Chiefs at Bills 8:20pm ET.',
    source: 'NFL',
    art: null,
  },
  {
    n: 6,
    region: 'INDIA · DOHA',
    badgeLabel: 'CONFIRMED',
    badgeColor: GREEN,
    title: 'CONSTITUTION DAY — AND A CRICKET SEMI',
    deck: 'Samvidhan Divas in India; India A face Sri Lanka A in the Rising Stars semi, Doha.',
    source: 'INDIAN PRESS · SPORTSTAK',
    art: null,
  },
];

// "ALSO ON 26 NOVEMBER" — one-line briefs, numbered 7-34.
const ALSO: string[] = [
  'PIA UK FLIGHTS BACK ON OWN 777S — REUTERS',
  'US MARKETS SHUT FOR THANKSGIVING — REUTERS',
  "MACY'S BALLOONS MAY BE GROUNDED — USATODAY",
  "NOR'EASTER HITS EAST COAST — THETRAVELER",
  "MIAMI'S BUSIEST THANKSGIVING — THETRAVEL",
  'AIRLINE WAIVERS FOR THE HOLIDAY — QUE.COM',
  'COLLEGE FOOTBALL: PURDUE–OKLAHOMA — FOX',
  '6,000 IIT SEATS: ROBOTICS, AI — SELFSTUDYS',
  'INDIA SPACE ECONOMY $9B–$45B — STUDMENTOR',
  'BRAZIL: VIRAL CASES DOWN 68% — STUDMENTOR',
  'OLYMPIACOS–MILAN · 17:45 UTC',
  'PLZEN–BENFICA · 17:45 UTC',
  'DINAMO ZAGREB–LEVERKUSEN · 17:45 UTC',
  'CELTA–BOURNEMOUTH · 17:45 UTC',
  "BESIKTAS–HAPOEL BE'ER SHEVA · 17:45 UTC",
  'MARSEILLE–LEVSKI SOFIA · 17:45 UTC',
  'SALZBURG–ARARAT-ARMENIA · 17:45 UTC',
  'UNION SG–LECH POZNAN · 17:45 UTC',
  'CRYSTAL PALACE–REAL SOCIEDAD · 20:00 UTC',
  'JUVENTUS–OMONIA · 20:00 UTC',
  'LYON–LILLESTROM · 20:00 UTC',
  'SUNDERLAND–JAGIELLONIA · 20:00 UTC',
  'SPARTA PRAHA–AZ ALKMAAR · 20:00 UTC',
  'HOFFENHEIM–STURM GRAZ · 20:00 UTC',
  'FERENCVAROS–CELJE · 20:00 UTC',
  'OFI–ANDERLECHT · 20:00 UTC',
  'NEC–RENNES · 20:00 UTC',
  'TORREENSE–CELTIC · 20:00 UTC',
];

// DATE CHECK — big stories deliberately LEFT OUT: they happened 23-25 Nov.
const DATE_CHECK: string[] = [
  'Shenzhou-24 launch — 25 Nov',
  'Cairo tanker fire, 31 dead — 25 Nov',
  'Sudan drone strikes, 19 dead — 25 Nov',
  'Bangladesh wage hike +36% — 25 Nov',
  'N. Korea expels Swiss envoy — 25 Nov',
  'Gaza strike kills Hamas chief — 25 Nov',
  'Ramaphosa wins Phala Phala — 25 Nov',
  'Hera asteroid crater images — 25 Nov',
  'Netanyahu charges eased — 25 Nov',
  'BepiColombo at Mercury — 23 Nov',
  'COP31 talks collapse — 23 Nov',
  'Nvidia reinstates Huang — 23 Nov',
  'Colombia peace deal, 10 yrs — 24 Nov',
  'Venezuela debt $237.5B — 24 Nov',
  'IPL auction register — 25 Nov',
  'Hasina plans Dec 16 return — 24 Nov',
  'Sooryavanshi 204 off 53 — 24 Nov',
  'Lebanon 2nd airport plan — 25 Nov',
];

// ---------------------------------------------------------------- art
function drawParadeArt(x: number, y: number, w: number, h: number): void {
  // City skyline + one big balloon.
  fillRect(x, y, w, h, [214, 228, 238]);
  const base = y + h;
  const towers: Array<[number, number, number]> = [
    [0, 46, 30],
    [16, 34, 22],
    [34, 52, 26],
    [56, 30, 30],
    [80, 44, 22],
  ];
  for (const [tx, th, tw] of towers) {
    fillRect(x + Math.floor((tx / 100) * w), base - Math.floor((th / 100) * h), Math.floor((tw / 100) * w), Math.floor((th / 100) * h), DARK);
  }
  // Balloon: round body, basket, strings — sized to stay inside the art box.
  const bx = x + Math.floor(w * 0.62);
  const by = y + Math.floor(h * 0.3);
  fillEllipse(bx, by, 20, 15, RED);
  fillEllipse(bx - 6, by - 3, 8, 6, [214, 64, 76]);
  line(bx - 9, by + 12, bx - 5, by + 22, INK);
  line(bx + 9, by + 12, bx + 5, by + 22, INK);
  fillRect(bx - 6, by + 22, 12, 6, [120, 84, 40]);
  // Small second balloon.
  fillEllipse(x + Math.floor(w * 0.2), y + Math.floor(h * 0.28), 10, 8, BLUE);
  // Confetti dots.
  const dots: Array<[number, number, RGB]> = [
    [0.1, 0.15, RED],
    [0.3, 0.1, BLUE],
    [0.5, 0.2, GREEN],
    [0.85, 0.12, RED],
    [0.92, 0.3, BLUE],
    [0.42, 0.42, AMBER],
  ];
  for (const [fx, fy, c] of dots) fillRect(x + Math.floor(fx * w), y + Math.floor(fy * h), 3, 3, c);
}

function drawChessArt(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CREAM2);
  const n = 6;
  const s = Math.floor(Math.min(w, h - 4) / n);
  const ox = x + Math.floor((w - s * n) / 2);
  const oy = y + Math.floor((h - s * n) / 2);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      fillRect(ox + c * s, oy + r * s, s, s, (r + c) % 2 === 0 ? WHITE : INK);
    }
  }
  strokeRect(ox, oy, s * n, s * n, INK, 2);
  // Two kings facing off.
  fillCircle(ox + Math.floor(s * 1.5), oy + Math.floor(s * 1.5), Math.floor(s * 0.42), RED);
  drawText(ox + Math.floor(s * 1.5) - 3, oy + Math.floor(s * 1.5) - 4, 'K', 1, WHITE);
  fillCircle(ox + Math.floor(s * 4.5), oy + Math.floor(s * 4.5), Math.floor(s * 0.42), BLUE);
  drawText(ox + Math.floor(s * 4.5) - 3, oy + Math.floor(s * 4.5) - 4, 'K', 1, WHITE);
}

function drawBallArt(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [214, 228, 238]);
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  const r = Math.floor(Math.min(w, h) * 0.36);
  fillCircle(cx, cy, r, WHITE);
  strokeCircle(cx, cy, r, INK);
  // Centre pentagon.
  const pr = Math.floor(r * 0.42);
  const pent: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pent.push([cx + Math.floor(pr * Math.cos(a)), cy + Math.floor(pr * Math.sin(a))]);
  }
  fillPoly(pent, INK);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    line(cx + Math.floor(pr * Math.cos(a)), cy + Math.floor(pr * Math.sin(a)), cx + Math.floor(r * 0.95 * Math.cos(a)), cy + Math.floor(r * 0.95 * Math.sin(a)), INK);
  }
  // Grass line.
  fillRect(x, y + h - 8, w, 8, [90, 140, 80]);
}

// ---------------------------------------------------------------- map
interface City {
  lon: number;
  lat: number;
  n?: number;
}
const MAP_CITIES: City[] = [
  { lon: -74, lat: 40.7, n: 1 }, // New York — parade
  { lon: 6.1, lat: 46.2, n: 2 }, // Geneva — chess
  { lon: 23.6, lat: 37.9, n: 3 }, // Piraeus — Europa League
  { lon: -80.2, lat: 25.8, n: 4 }, // Miami — travel
  { lon: -96.8, lat: 32.8, n: 5 }, // Dallas — NFL
  { lon: 77.2, lat: 28.6, n: 6 }, // New Delhi — India
  { lon: -78.9, lat: 42.9 }, // Buffalo
  { lon: 51.5, lat: 25.3 }, // Doha
  { lon: -46.6, lat: -23.5 }, // Sao Paulo
  { lon: 13.4, lat: 49.7 }, // Plzen
  { lon: 16, lat: 45.8 }, // Zagreb
  { lon: -8.7, lat: 42.2 }, // Vigo
  { lon: 29, lat: 41 }, // Istanbul
  { lon: 5.4, lat: 43.3 }, // Marseille
  { lon: 13, lat: 47.8 }, // Salzburg
  { lon: 4.35, lat: 50.85 }, // Brussels
  { lon: -0.1, lat: 51.5 }, // London
  { lon: 7.7, lat: 45.1 }, // Turin
  { lon: 4.8, lat: 45.75 }, // Lyon
  { lon: -1.38, lat: 54.9 }, // Sunderland
  { lon: 14.4, lat: 50.1 }, // Prague
  { lon: 8.9, lat: 49.25 }, // Sinsheim
];

function drawMap(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, OCEAN);
  const px = (lon: number): number => x + Math.floor(((lon + 180) / 360) * w);
  const py = (lat: number): number => y + Math.floor(((85 - lat) / 145) * h);
  const poly = (pts: Array<[number, number]>): void =>
    fillPoly(
      pts.map(([lo, la]) => [px(lo), py(la)] as [number, number]),
      LAND,
    );
  // North America
  poly([
    [-168, 66], [-140, 70], [-125, 71], [-110, 68], [-95, 69], [-85, 66], [-80, 73],
    [-65, 60], [-55, 52], [-60, 47], [-70, 44], [-75, 39], [-80, 32], [-81, 26],
    [-84, 30], [-90, 21], [-97, 16], [-94, 17], [-105, 20], [-110, 23], [-115, 29],
    [-120, 34], [-125, 40], [-125, 48], [-132, 58], [-150, 60], [-165, 60],
  ]);
  // Greenland
  poly([[-58, 64], [-45, 60], [-40, 65], [-30, 68], [-22, 70], [-30, 76], [-45, 76], [-58, 74]]);
  // South America
  poly([
    [-80, 9], [-75, 10], [-70, 12], [-62, 10], [-52, 5], [-50, 0], [-44, -3],
    [-35, -8], [-40, -20], [-48, -28], [-52, -33], [-58, -38], [-65, -45], [-68, -52],
    [-70, -55], [-73, -50], [-73, -40], [-72, -30], [-70, -18], [-77, -12], [-80, -5], [-81, 0],
  ]);
  // Europe
  poly([
    [-10, 36], [-9, 43], [-2, 44], [-1, 46], [-4, 48], [-1, 50], [2, 51], [5, 53],
    [8, 55], [8, 57], [10, 59], [5, 60], [5, 62], [10, 64], [18, 69], [25, 71],
    [30, 70], [35, 68], [40, 67], [45, 68], [50, 69], [55, 68], [60, 69], [65, 68],
    [68, 66], [62, 62], [58, 58], [52, 55], [48, 52], [44, 50], [40, 48], [36, 46],
    [32, 45], [28, 44], [24, 40], [22, 37], [26, 38], [30, 36], [33, 36], [36, 36],
    [30, 36], [27, 37], [23, 36], [19, 38], [16, 39], [12, 42], [8, 38], [3, 38],
    [-1, 37], [-6, 36],
  ]);
  // Africa
  poly([
    [-17, 15], [-16, 20], [-15, 27], [-10, 31], [-5, 35], [0, 36], [10, 37], [11, 34],
    [15, 32], [20, 32], [25, 32], [30, 31], [32, 31], [34, 28], [35, 23], [37, 18],
    [40, 15], [43, 12], [48, 11], [51, 12], [48, 5], [42, 0], [40, -5], [40, -12],
    [36, -18], [33, -26], [28, -33], [20, -35], [17, -32], [15, -27], [12, -18],
    [12, -10], [9, -1], [9, 4], [-8, 4], [-13, 8], [-17, 12],
  ]);
  // Asia
  poly([
    [68, 66], [75, 72], [80, 73], [90, 75], [100, 76], [110, 74], [120, 73], [130, 72],
    [140, 72], [150, 70], [160, 70], [170, 66], [178, 65], [170, 60], [162, 56],
    [158, 52], [150, 59], [142, 55], [140, 50], [135, 43], [130, 42], [127, 40],
    [122, 38], [120, 32], [122, 28], [118, 25], [110, 20], [108, 15], [105, 10],
    [103, 8], [100, 7], [98, 10], [95, 15], [92, 20], [88, 22], [85, 19], [80, 15],
    [77, 8], [75, 12], [72, 20], [68, 23], [65, 25], [60, 25], [57, 26], [54, 26],
    [52, 28], [50, 29], [48, 30], [44, 29], [42, 25], [40, 20], [38, 18], [35, 15],
    [33, 12], [38, 10], [42, 12], [44, 15], [48, 14], [52, 15], [55, 17], [58, 20],
    [60, 23], [62, 25], [66, 25], [68, 24], [70, 26], [72, 30], [74, 35], [74, 40],
    [72, 45], [70, 50], [68, 55], [66, 60], [64, 64], [62, 66],
  ]);
  // Australia
  poly([
    [114, -22], [114, -30], [115, -35], [120, -34], [124, -33], [129, -32], [132, -32],
    [135, -35], [137, -35], [140, -38], [142, -39], [145, -38], [147, -39], [150, -37],
    [153, -32], [153, -27], [151, -24], [146, -19], [142, -15], [142, -11], [137, -12],
    [135, -15], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20],
  ]);
  // UK + Japan + islands as small blobs.
  poly([[-5, 50], [-3, 53], [-5, 56], [-3, 58], [-1, 57], [0, 53], [1, 51]]);
  poly([[130, 31], [132, 33], [135, 34], [137, 35], [139, 35], [140, 38], [141, 41], [143, 43], [145, 44], [142, 42], [140, 39]]);
  fillEllipse(px(114), py(0), 8, 4, LAND); // Borneo
  fillEllipse(px(102), py(-2), 6, 3, LAND); // Sumatra
  fillEllipse(px(110), py(-7), 7, 2, LAND); // Java
  fillEllipse(px(141), py(-5), 9, 4, LAND); // New Guinea
  // City dots.
  for (const c of MAP_CITIES) {
    const cx = px(c.lon);
    const cy = py(c.lat);
    if (c.n !== undefined) {
      fillCircle(cx, cy, 7, RED);
      strokeCircle(cx, cy, 7, WHITE);
      drawText(cx - 3, cy - 4, String(c.n), 1, WHITE);
    } else {
      fillCircle(cx, cy, 3, RED);
    }
  }
}

// ---------------------------------------------------------------- layout
const MX = 8; // page margin
const PW = W - 2 * MX; // 1008

function drawLeadPanel(l: Lead, x: number, y: number, w: number, h: number, titleScale: number): void {
  fillRect(x, y, w, h, WHITE);
  strokeRect(x, y, w, h, INK, 2);
  const ix = x + 8;
  const iw = w - 16;
  // Header: number badge, region, verification badge.
  fillRect(ix, y + 8, 20, 20, RED);
  drawText(ix + (l.n < 10 ? 7 : 4), y + 14, String(l.n), 2, WHITE);
  drawText(ix + 26, y + 14, l.region, 2, BLUE);
  const bw = textWidth(l.badgeLabel, 1) + 12;
  fillRect(x + w - 8 - bw, y + 8, bw, 13, l.badgeColor);
  drawText(x + w - 8 - bw + 6, y + 11, l.badgeLabel, 1, WHITE);
  let cy = y + 34;
  // Art strip (row A only).
  if (l.art) {
    const ah = 52;
    if (l.art === 'parade') drawParadeArt(ix, cy, iw, ah);
    if (l.art === 'chess') drawChessArt(ix, cy, iw, ah);
    if (l.art === 'ball') drawBallArt(ix, cy, iw, ah);
    strokeRect(ix, cy, iw, ah, INK, 1);
    cy += ah + 6;
  }
  // Title, wrapped, max 2 lines.
  const titleLines = wrapText(l.title, iw, titleScale).slice(0, 2);
  for (const tl of titleLines) {
    drawText(ix, cy, tl, titleScale, INK);
    cy += titleScale === 3 ? 25 : 19;
  }
  cy += 2;
  // Deck, wrapped, hard-capped at 3 lines so it can never hit the source line.
  const deckLines = wrapText(l.deck, iw, 2);
  if (deckLines.length > 3) {
    deckLines.length = 3;
    const last = deckLines[2];
    deckLines[2] = last.length > 3 ? last.slice(0, -3) + '...' : last;
  }
  for (const dl of deckLines) {
    drawText(ix, cy, dl, 2, INK);
    cy += 17;
  }
  // Source line, pinned to the panel bottom.
  drawText(ix, y + h - 16, 'SOURCE: ' + l.source, 1, GREY);
}

function drawNumbersBox(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, WHITE);
  strokeRect(x, y, w, h, INK, 2);
  drawText(x + 8, y + 6, 'THE DAY IN NUMBERS', 2, RED);
  hline(x + 8, y + 22, w - 16, RULEC, 1);
  const stats: Array<[string, string]> = [
    ['81.5M', 'Americans travelling 24-30 Nov'],
    ['417,000', 'flights forecast, busiest in 16 yrs'],
    ['100', "inflatables in Macy's 100th parade"],
    ['18', 'Europa League ties tonight'],
    ['3', 'NFL games on Thanksgiving Day'],
  ];
  let cy = y + 28;
  for (const [num, label] of stats) {
    drawText(x + 8, cy, num, 2, RED);
    drawText(x + 96, cy, label, 2, INK);
    cy += 16;
  }
}

function drawDateCheck(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CREAM2);
  strokeRect(x, y, w, h, INK, 2);
  drawText(x + 8, y + 6, 'DATE CHECK — LEFT OUT ON PURPOSE', 2, RED);
  const colW = Math.floor((w - 16) / 2);
  let idx = 0;
  for (let col = 0; col < 2; col++) {
    for (let row = 0; row < 9; row++) {
      if (idx >= DATE_CHECK.length) break;
      drawText(x + 8 + col * colW, y + 19 + row * 9, 'x ' + DATE_CHECK[idx], 1, INK);
      idx++;
    }
  }
}

function render(): Buffer {
  fillRect(0, 0, W, H, PAPER);

  // ---- Masthead
  drawTextCentered(W / 2, 6, 'THE WORLD IN ONE DAY · MAKE.FUN NEWS-IMAGE', 2, RED);
  drawTextCentered(W / 2, 24, 'THURSDAY 26 NOVEMBER 2026', 4, INK);
  drawTextCentered(W / 2, 56, '34 DATED STORIES · 5 REGIONS · 7 FIELDS · EVERY STORY FROM TODAY', 2, BLUE);
  hline(MX, 76, PW, INK, 2);

  // ---- Timeline strip
  let y = 82;
  drawText(MX, y, 'THE DAY IN UTC', 2, RED);
  drawText(MX + textWidth('THE DAY IN UTC', 2) + 16, y, '— ALL TIMES THURSDAY 26 NOVEMBER 2026', 2, GREY);
  y += 20;
  const tl1 = ['13:30 PARADE NYC', '14:00 CHESS GENEVA', '17:45 EUROPA x8', '18:00 BEARS-LIONS'];
  const tl2 = ['20:00 EUROPA x10', '21:30 EAGLES-COWBOYS', '01:20 CHIEFS-BILLS', '81.5M TRAVEL'];
  drawText(MX, y, tl1.join(' · '), 2, INK);
  y += 18;
  drawText(MX, y, tl2.join(' · '), 2, INK);
  hline(MX, y + 20, PW, RULEC, 1);

  // ---- Lead rows
  const gap = 8;
  const colW = Math.floor((PW - 2 * gap) / 3);
  y = 142;
  const rowAH = 212;
  for (let i = 0; i < 3; i++) {
    drawLeadPanel(LEADS_A[i], MX + i * (colW + gap), y, colW, rowAH, 3);
  }
  y += rowAH + gap;
  const rowBH = 150;
  for (let i = 0; i < 3; i++) {
    drawLeadPanel(LEADS_B[i], MX + i * (colW + gap), y, colW, rowBH, 2);
  }
  y += rowBH + gap;

  // ---- Map + right column (numbers + date check)
  const mapY = y;
  const mapH = 222;
  const mapW = 500;
  drawText(MX, mapY, 'WHERE IT HAPPENED', 2, RED);
  drawMap(MX, mapY + 20, mapW, mapH - 34);
  strokeRect(MX, mapY + 20, mapW, mapH - 34, INK, 2);
  drawText(MX, mapY + mapH - 12, '1-6 LEAD STORIES · SMALL DOTS: OTHER STORIES', 1, GREY);
  const rx = MX + mapW + gap;
  const rw = PW - mapW - gap;
  drawNumbersBox(rx, mapY, rw, 112);
  drawDateCheck(rx, mapY + 120, rw, mapH - 120);
  y = mapY + mapH + gap;

  // ---- ALSO list
  drawText(MX, y, 'ALSO ON 26 NOVEMBER', 2, RED);
  drawText(MX + textWidth('ALSO ON 26 NOVEMBER', 2) + 16, y, '— 28 MORE DATED, SOURCED STORIES', 2, GREY);
  y += 20;
  const alsoColW = Math.floor((PW - gap) / 2);
  const rows = Math.ceil(ALSO.length / 2);
  for (let i = 0; i < ALSO.length; i++) {
    const col = i < rows ? 0 : 1;
    const row = i % rows;
    const ix = MX + col * (alsoColW + gap);
    const iy = y + row * 16;
    const num = String(7 + i);
    drawText(ix, iy, num, 2, RED);
    drawText(ix + textWidth(num + ' ', 2), iy, ALSO[i], 2, INK);
  }
  y += rows * 16 + 4;

  // ---- Footer
  drawText(MX, y, 'SOURCES: UEFA · NFL · FIDE · CHESSBASE · MACY\'S · AAA · FAA · REUTERS · USA TODAY · SELFSTUDYS · STUDMENTOR · SPORTSTAK · ESSENTIALLY SPORTS', 1, GREY);
  y += 11;
  drawText(MX, y, 'NOT YET: Black Friday sales (28 Nov) · F1 Qatar GP practice (27 Nov) · Chess rest day (27 Nov) · IPL auction (16 Dec) · Hasina return (16 Dec) · Lebanon flights (14 Dec)', 1, GREY);

  return encodePng(W, H, img);
}

// ---------------------------------------------------------------- validation
// Layout self-check: every text run must fit its box. Any overflow is logged
// (and would have shown up as clipped text in v1) instead of silently drawing
// past a panel edge.
function validateLayout(): void {
  const problems: string[] = [];
  const colW = Math.floor((PW - 2 * 8) / 3);
  const iw = colW - 16;
  for (const l of [...LEADS_A, ...LEADS_B]) {
    const ts = LEADS_A.includes(l) ? 3 : 2;
    if (wrapText(l.title, iw, ts).length > 2) problems.push(`title wraps >2 lines: ${l.title}`);
    if (wrapText(l.deck, iw, 2).length > 3) problems.push(`deck wraps >3 lines: ${l.deck}`);
    if (textWidth(l.region, 2) + 26 + textWidth(l.badgeLabel, 1) + 12 > iw) {
      problems.push(`header too wide: ${l.region}`);
    }
  }
  const alsoColW = Math.floor((PW - 8) / 2);
  ALSO.forEach((item, i) => {
    const w = textWidth(String(7 + i) + ' ' + item, 2);
    if (w > alsoColW) problems.push(`ALSO #${7 + i} too wide (${w}px > ${alsoColW}px): ${item}`);
  });
  for (const item of DATE_CHECK) {
    if (textWidth('x ' + item, 1) > Math.floor((500 - 16) / 2)) {
      problems.push(`DATE CHECK too wide: ${item}`);
    }
  }
  if (textWidth('THURSDAY 26 NOVEMBER 2026', 4) > PW) problems.push('masthead date too wide');
  if (textWidth('34 DATED STORIES · 5 REGIONS · 7 FIELDS · EVERY STORY FROM TODAY', 2) > PW) {
    problems.push('masthead subline too wide');
  }
  for (const row of [
    '13:30 PARADE NYC · 14:00 CHESS GENEVA · 17:45 EUROPA x8 · 18:00 BEARS-LIONS',
    '20:00 EUROPA x10 · 21:30 EAGLES-COWBOYS · 01:20 CHIEFS-BILLS · 81.5M TRAVEL',
  ]) {
    if (textWidth(row, 2) > PW) problems.push(`timeline row too wide: ${row}`);
  }
  if (problems.length) {
    for (const p of problems) console.warn('LAYOUT: ' + p);
  } else {
    console.log('layout check: OK (34 stories, all text fits)');
  }
}

// ---------------------------------------------------------------- main
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
validateLayout();
mkdirSync(outDir, { recursive: true });
const png = render();
const outPath = join(outDir, 'entry.png');
writeFileSync(outPath, png);
const sha = createHash('sha256').update(png).digest('hex');
console.log(`wrote ${outPath} (${png.length} bytes, sha256 ${sha})`);
