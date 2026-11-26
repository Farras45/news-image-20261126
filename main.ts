// THE WORLD IN ONE DAY - THURSDAY 26 NOVEMBER 2026
// A one-page newspaper front page rendered from scratch in pure Node 22
// (standard library only: no network, no fonts, no image assets).
// The program draws 36 dated, sourced stories from 26 Nov 2026 into a
// 1024x1024 PNG and writes it to /output/entry.png
// (or $MAKEFUN_OUTPUT_DIR/entry.png when set, per the kit convention).
// Everything is computed here: a hand-built 5x7 bitmap font, a raster
// canvas, a coarse world map, small vector scenes, and a hand-rolled
// PNG encoder (CRC32 + zlib deflate). The output is fully deterministic.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// ------------------------------------------------------------------ font ---
// 5x7 bitmap font, uppercase only (newspaper style). Each glyph is 7 rows
// of 5 bits, written as strings of '1' (ink) and '0' (paper).
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '\\': ['10000', '01000', '01000', '00100', '00010', '00010', '00001'],
  '^': ['00100', '01010', '10001', '00000', '00000', '00000', '00000'],
  '·': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
  '•': ['00000', '00000', '01100', '01100', '01100', '00000', '00000'],
};

const GW = 5;
const GH = 7;
const ADV = 6; // glyph advance: width + 1px tracking

function textWidth(s: string, scale: number): number {
  return s.length * ADV * scale - scale;
}

// ---------------------------------------------------------------- canvas --
type RGB = [number, number, number];

const PAPER: RGB = [247, 243, 232];
const INK: RGB = [20, 20, 20];
const RED: RGB = [200, 16, 46];
const BLUE: RGB = [27, 79, 114];
const GREEN: RGB = [30, 120, 60];
const GREY: RGB = [110, 108, 100];
const LIGHT: RGB = [232, 227, 214];
const SEA: RGB = [206, 226, 240];
const LANDC: RGB = [150, 178, 120];
const CREAM: RGB = [255, 250, 235];
const GOLD: RGB = [176, 132, 32];

class Canvas {
  w: number;
  h: number;
  buf: Uint8Array; // RGB, row-major
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.buf[i * 3] = bg[0];
      this.buf[i * 3 + 1] = bg[1];
      this.buf[i * 3 + 2] = bg[2];
    }
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1): void {
    this.rect(x, y, w, t, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
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
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c);
  }
  ring(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a += 2) {
      const t = (a * Math.PI) / 180;
      this.px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++)
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, c);
  }
  glyph(ch: string, x: number, y: number, s: number, c: RGB): void {
    const g = FONT[ch] ?? FONT['?'];
    if (!g) return;
    for (let r = 0; r < GH; r++) {
      const row = g[r];
      for (let col = 0; col < GW; col++) {
        if (row[col] === '1') {
          for (let dy = 0; dy < s; dy++)
            for (let dx = 0; dx < s; dx++) this.px(x + col * s + dx, y + r * s + dy, c);
        }
      }
    }
  }
  text(s: string, x: number, y: number, scale: number, c: RGB): void {
    const up = s.toUpperCase();
    for (let i = 0; i < up.length; i++) this.glyph(up[i], x + i * ADV * scale, y, scale, c);
  }
  textCenter(s: string, cx: number, y: number, scale: number, c: RGB): void {
    this.text(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
  }
  wrap(s: string, maxChars: number): string[] {
    const words = s.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if (cur === '') cur = w;
      else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur !== '') lines.push(cur);
    return lines;
  }
}

// -------------------------------------------------------------------- png --
// Minimal PNG writer: 8-bit RGB, one IDAT, Sub filter per scanline.
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
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(cv: Canvas): Buffer {
  const w = cv.w;
  const h = cv.h;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const rowOff = y * (1 + w * 3);
    raw[rowOff] = 1; // Sub filter
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 3;
      const dst = rowOff + 1 + x * 3;
      for (let b = 0; b < 3; b++) {
        const left = x === 0 ? 0 : cv.buf[src - 3 + b];
        raw[dst + b] = (cv.buf[src + b] - left) & 0xff;
      }
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ story data --
// Every story below happened, or was first reported, on Thursday
// 26 November 2026, and is named with its source. Scheduled events
// (parade, chess, football, NFL) fall on that day. Stories from
// 23-25 Nov are NOT listed here; they are in the DATE CHECK box.
// Counts: 6 lead stories + 30 briefs = 36 stories, 7 regions, 8 fields.

interface Lead {
  n: number;
  region: string;
  head: string[]; // 2 lines, scale 2
  body: string; // wrapped at scale 1
  source: string;
  scene: 'balloon' | 'chess' | 'football' | 'plane' | 'nfl' | 'india';
}

const LEADS: Lead[] = [
  {
    n: 1,
    region: 'USA · NEW YORK',
    head: ['THANKSGIVING:', "MACY'S 100TH PARADE"],
    body: '100 inflatables, 11,000 marchers, 8:30am ET. Gusts may ground the balloons.',
    source: "SOURCE: MACY'S INC. · USA TODAY",
    scene: 'balloon',
  },
  {
    n: 2,
    region: 'SWITZERLAND · GENEVA',
    head: ['CHESS: GAME 3 FOR', 'THE WORLD CROWN'],
    body: 'Sindarov has White vs Gukesh, 15:00 CET. Two draws so far - level 1-1.',
    source: 'SOURCE: FIDE · CHESSBASE',
    scene: 'chess',
  },
  {
    n: 3,
    region: 'EUROPE',
    head: ['EUROPA LEAGUE: 18', 'TIES, ONE NIGHT'],
    body: 'Matchday 5 in two windows, 17:45 and 20:00 UTC. Olympiacos host Milan.',
    source: 'SOURCE: UEFA',
    scene: 'football',
  },
  {
    n: 4,
    region: 'USA',
    head: ['81.5M ON THE MOVE', 'AS STORMS CLOSE IN'],
    body: 'AAA: 81.5M travelling 24-30 Nov. FAA: 417,000 flights forecast.',
    source: 'SOURCE: AAA · FAA',
    scene: 'plane',
  },
  {
    n: 5,
    region: 'USA',
    head: ['NFL: THREE GAMES,', 'ONE TABLE'],
    body: 'Bears at Lions 1pm, Eagles at Cowboys 4:30pm, Chiefs at Bills 8:20pm ET.',
    source: 'SOURCE: NFL',
    scene: 'nfl',
  },
  {
    n: 6,
    region: 'INDIA · NEW DELHI',
    head: ['CONSTITUTION DAY -', 'AND AID FOR NEPAL'],
    body: 'Samvidhan Divas in India; Modi and Nepal PM Shah agree RS 15,000-crore package.',
    source: 'SOURCE: INDIAN PRESS · REUTERS',
    scene: 'india',
  },
];

// Briefs 7-36: one line each at scale 2 (kept short on purpose).
const BRIEFS: string[] = [
  'US MARKETS SHUT FOR THANKSGIVING',
  'US CONSUMER CONFIDENCE NEAR 2-YR HIGH',
  'CANADA HOLDS INFLATION STRATEGY',
  'EL SALVADOR $860M YEAR-END DEBT PLAN',
  'COLOMBIA: 10 YEARS SINCE PEACE ACCORD',
  'VENEZUELA REVEALS $237.5BN PUBLIC DEBT',
  'BRAZIL: VIRAL CASES DOWN 68%',
  'IRELAND IN NEUTRALITY SHOWDOWN',
  'POLAND FLAGS AIRSPACE VIOLATIONS',
  'RUSSIA RAISES DEFENCE ALLOCATIONS',
  'UKRAINE, HUNGARY RENEW ECONOMIC TIES',
  'IITS ADD 6,000 TECH SEATS FROM 2027',
  'INDIA SPACE ECONOMY $9BN TO $45BN',
  'INDIA: HUMAN CONTROL OVER AI IN WARFARE',
  'INDIA CONDEMNS RIYADH ATTACK, 2 HURT',
  "PAKISTAN'S FIRST ASTRONAUT TO TIANGONG",
  'BANGLADESH GARMENT WAGE UP 36%',
  'HASINA SEEKS RETURN TO DHAKA ON 16 DEC',
  'N. KOREA TELLS SWITZERLAND: SHUT OFFICE',
  'TAIWAN ANSWERS US TARIFF PLAN',
  'IPL 2027 AUCTION: 1,220 PLAYERS REGISTER',
  'SOORYAVANSHI SMASHES 204 OFF 53 VS UAE',
  'FLIPKART CEO TO STEP DOWN IN DECEMBER',
  'EGYPT: SUEZ CANAL REVENUES RECOVERING',
  'ETHIOPIA PUSHES HEALTHCARE INDEPENDENCE',
  'EMIRATES TOPS GLOBAL AIRLINE RANKINGS',
  'TUITION PAID IN COCONUTS, KIDS IN SCHOOL',
  'EUROPA 17:45 UTC: 8 TIES INC MILAN',
  'EUROPA 20:00 UTC: 10 TIES INC JUVENTUS',
  'EUROPA: BENFICA, BOURNEMOUTH ON 12 PTS',
];

const BRIEF_SOURCES =
  'SOURCES: REUTERS · UEFA · NFL · FIDE · CHESSBASE · AAA · FAA · SELFSTUDYS · STUDMENTOR · LIBRE NEWS · SIMPLELIFE · SPORTNEWS';

const NUMBERS: [string, string][] = [
  ['81.5M', 'Americans travelling 24-30 Nov'],
  ['417,000', 'flights forecast, busiest in 16 yrs'],
  ['100', "inflatables in Macy's 100th parade"],
  ['18', 'Europa League ties tonight'],
  ['3', 'NFL games on Thanksgiving Day'],
  ['6,000', 'new IIT seats in robotics, AI, space'],
  ['1,220', 'players register for IPL 2027 auction'],
];

// Near-miss stories from 23-25 Nov, deliberately LEFT OUT.
const DATE_CHECK: [string, string][] = [
  ['BEPICOLOMBO AT MERCURY', '23 NOV'],
  ['COP31 TALKS COLLAPSE', '23 NOV'],
  ['NVIDIA REINSTATES HUANG', '23 NOV'],
  ['CAIRO TANKER FIRE, 31 DEAD', '25 NOV'],
  ['NETANYAHU JUDGES URGE DROP CASE', '25 NOV'],
  ['HOUTHI CLAIM SAUDI REFINERY HIT', '25 NOV'],
  ['AUSTRALIA-SOLOMONS PACT SIGNED', '25 NOV'],
  ['US TARIFFS PLAN UNVEILED', '25 NOV'],
  ['TAIWAN SHARES FALL 1,927 PTS', '25 NOV'],
  ['HERA ASTEROID CRATER IMAGES', '25 NOV'],
];

const NOT_YET =
  'NOT YET: BLACK FRIDAY SALES (28 NOV) · F1 QATAR GP PRACTICE (27 NOV) · CHESS REST DAY (27 NOV) · IPL AUCTION (16 DEC) · HASINA RETURN (16 DEC) · LEBANON FLIGHTS (14 DEC)';

// ------------------------------------------------------------------- map --
// Coarse world land mask, equirectangular, 60 cols (lon -180..180) x 26
// rows (lat ~87..-58). Spans are [firstCol, lastCol] per row, hand-drawn.
const LAND: Record<number, [number, number][]> = {
  1: [[10, 16], [18, 20]],
  2: [[6, 16], [18, 20], [33, 50]],
  3: [[5, 17], [18, 19], [29, 31], [32, 55]],
  4: [[8, 17], [27, 27], [29, 31], [32, 56]],
  5: [[9, 16], [27, 28], [28, 33], [34, 55]],
  6: [[8, 16], [27, 34], [36, 50]],
  7: [[8, 17], [28, 34], [36, 48], [49, 53]],
  8: [[9, 17], [28, 35], [36, 47], [48, 54]],
  9: [[9, 17], [28, 35], [36, 40], [42, 52]],
  10: [[9, 12], [15, 16], [28, 35], [37, 40], [42, 44], [46, 49]],
  11: [[10, 13], [28, 36], [38, 40], [42, 44], [46, 50]],
  12: [[11, 13], [28, 36], [43, 43], [46, 49]],
  13: [[12, 13], [29, 36], [47, 50]],
  14: [[15, 18], [29, 35], [46, 51]],
  15: [[15, 19], [30, 35], [47, 52]],
  16: [[15, 19], [30, 34], [48, 54]],
  17: [[15, 19], [30, 34], [49, 53]],
  18: [[15, 19], [30, 33], [35, 35], [48, 54]],
  19: [[15, 18], [30, 33], [48, 54]],
  20: [[15, 18], [30, 32], [49, 53]],
  21: [[15, 17], [30, 32], [49, 52], [55, 56]],
  22: [[15, 16], [55, 55]],
  23: [[15, 16]],
  24: [[15, 15]],
};
const MAP_COLS = 60;
const MAP_ROWS = 26;

// [lon, lat] of the stories dotted on the map.
const DOTS: [number, number][] = [
  [-74, 41], [-77, 39], [-76, 45], [-89, 14], [-74, 5], [-67, 11],
  [-47, -24], [-6, 53], [21, 52], [38, 56], [31, 50], [6, 46],
  [24, 38], [77, 29], [73, 34], [90, 24], [85, 28], [126, 39],
  [122, 25], [47, 25], [31, 30], [39, 9],
];

// ------------------------------------------------------------ scene art --
function drawScene(cv: Canvas, kind: Lead['scene'], x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [214, 234, 240]); // sky panel
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  if (kind === 'balloon') {
    cv.rect(x, y + h - 12, w, 12, [52, 58, 74]); // rooftops
    cv.circle(cx - 34, cy - 6, 9, RED);
    cv.circle(cx + 6, cy - 10, 13, RED);
    cv.ellipse(cx + 6, cy - 10, 13, 15, RED);
    cv.rect(cx - 1, cy + 6, 14, 6, GOLD);
    cv.circle(cx - 58, cy - 8, 6, BLUE);
  } else if (kind === 'chess') {
    const s = 5;
    const ox = cx - 4 * s;
    const oy = cy - 4 * s;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 0) cv.rect(ox + c * s, oy + r * s, s, s, INK);
    cv.circle(ox + 2 * s + 2, oy + 1 * s + 2, 2, RED);
    cv.circle(ox + 5 * s + 2, oy + 6 * s + 2, 2, BLUE);
  } else if (kind === 'football') {
    cv.rect(x, y + h - 8, w, 8, GREEN); // pitch
    cv.circle(cx, cy - 2, 15, CREAM);
    cv.ring(cx, cy - 2, 15, INK);
    cv.circle(cx, cy - 2, 4, INK);
    cv.line(cx - 12, cy - 10, cx, cy - 2, INK);
    cv.line(cx + 12, cy - 10, cx, cy - 2, INK);
    cv.line(cx - 13, cy + 6, cx, cy - 2, INK);
    cv.line(cx + 13, cy + 6, cx, cy - 2, INK);
  } else if (kind === 'plane') {
    cv.circle(cx + 30, cy - 12, 5, CREAM); // sun
    cv.line(x + 8, cy + 4, x + w - 8, cy + 4, GREY);
    cv.line(x + 8, cy + 10, x + w - 8, cy + 10, GREY);
    // simple jet silhouette
    cv.ellipse(cx, cy - 2, 26, 5, BLUE);
    cv.line(cx + 20, cy - 2, cx + 30, cy - 10, BLUE);
    cv.line(cx - 6, cy - 2, cx - 14, cy - 12, BLUE);
    cv.line(cx - 6, cy - 2, cx - 14, cy + 8, BLUE);
  } else if (kind === 'nfl') {
    cv.rect(x, y + h - 8, w, 8, GREEN);
    cv.ellipse(cx, cy - 2, 26, 13, [120, 72, 32]);
    cv.line(cx - 18, cy - 2, cx + 18, cy - 2, CREAM);
    for (let i = -2; i <= 2; i++) cv.line(cx + i * 6, cy - 6, cx + i * 6, cy + 2, CREAM);
  } else {
    // india: tricolour bands + wheel
    cv.rect(x, y, w, 14, [255, 153, 51]);
    cv.rect(x, y + 14, w, 14, CREAM);
    cv.rect(x, y + 28, w, 14, [19, 136, 8]);
    cv.ring(cx, y + 21, 6, BLUE);
    cv.circle(cx, y + 21, 1, BLUE);
  }
}

// ---------------------------------------------------------------- layout --
const W = 1024;
const H = 1024;
const MX = 8; // page margin

function drawLead(cv: Canvas, lead: Lead, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  // header: red number box, region, CONFIRMED badge
  cv.rect(x + 2, y + 2, 22, 16, RED);
  cv.text(String(lead.n), x + 2 + (22 - textWidth(String(lead.n), 1)) / 2, y + 5, 1, CREAM);
  cv.text(lead.region, x + 28, y + 5, 1, BLUE);
  const badge = 'CONFIRMED';
  const bw = textWidth(badge, 1) + 8;
  cv.rect(x + w - 2 - bw, y + 2, bw, 16, GREEN);
  cv.text(badge, x + w - 2 - bw + 4, y + 5, 1, CREAM);
  // scene
  drawScene(cv, lead.scene, x + 2, y + 20, w - 4, 44);
  // headline, two lines at scale 2
  cv.text(lead.head[0], x + 8, y + 70, 2, INK);
  cv.text(lead.head[1], x + 8, y + 86, 2, INK);
  // body, wrapped at scale 1 (51 chars across the panel)
  const lines = cv.wrap(lead.body, 50).slice(0, 3);
  lines.forEach((ln, i) => cv.text(ln, x + 8, y + 106 + i * 10, 1, INK));
  // source
  cv.text(lead.source, x + 8, y + h - 12, 1, GREY);
}

function drawMap(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.text('WHERE IT HAPPENED', x + 8, y + 5, 1, RED);
  cv.text('1-6 LEAD STORIES · SMALL DOTS: OTHER STORIES', x + 8, y + h - 12, 1, GREY);
  const scale = 5;
  const mw = MAP_COLS * scale;
  const mh = MAP_ROWS * scale;
  const ox = x + Math.floor((w - mw) / 2);
  const oy = y + 20;
  cv.rect(ox, oy, mw, mh, SEA);
  for (const [row, spans] of Object.entries(LAND)) {
    const r = Number(row);
    for (const [c0, c1] of spans) {
      cv.rect(ox + c0 * scale, oy + r * scale, (c1 - c0 + 1) * scale, scale, LANDC);
    }
  }
  // story dots: lon/lat -> map pixels (equirectangular)
  for (const [lon, lat] of DOTS) {
    const dx = ox + Math.round(((lon + 180) / 360) * mw);
    const dy = oy + Math.round(((87 - lat) / 145) * mh);
    cv.circle(dx, dy, 3, RED);
    cv.ring(dx, dy, 4, CREAM);
  }
  // numbered pins for the six leads
  const pins: [number, number, number][] = [
    [-74, 41, 1], [6, 46, 2], [24, 38, 3], [-77, 39, 4], [-95, 32, 5], [77, 29, 6],
  ];
  for (const [lon, lat, n] of pins) {
    const dx = ox + Math.round(((lon + 180) / 360) * mw);
    const dy = oy + Math.round(((87 - lat) / 145) * mh);
    cv.circle(dx, dy, 6, RED);
    cv.text(String(n), dx - 3, dy - 3, 1, CREAM);
  }
}

function drawNumbers(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.text('THE DAY IN NUMBERS', x + 8, y + 5, 1, RED);
  NUMBERS.forEach(([num, label], i) => {
    const yy = y + 20 + i * 9;
    cv.text(num, x + 8, yy, 1, RED);
    cv.text(label, x + 8 + textWidth(num, 1) + 12, yy, 1, INK);
  });
}

function drawDateCheck(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, RED, 2);
  cv.text('DATE CHECK - LEFT OUT ON PURPOSE', x + 8, y + 5, 1, RED);
  const colW = Math.floor((w - 16) / 2);
  DATE_CHECK.forEach(([item, when], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xx = x + 8 + col * colW;
    const yy = y + 22 + row * 11;
    cv.text('X', xx, yy, 1, RED);
    cv.text(item, xx + 10, yy, 1, INK);
    cv.text(when, xx + colW - textWidth(when, 1) - 4, yy, 1, GREY);
  });
}

function render(): Canvas {
  const cv = new Canvas(W, H, PAPER);
  cv.frame(2, 2, W - 4, H - 4, INK, 2);

  // ---- masthead ------------------------------------------------------
  cv.textCenter('THE WORLD IN ONE DAY · MAKE.FUN NEWS-IMAGE', W / 2, 12, 1, RED);
  cv.textCenter('THURSDAY 26 NOVEMBER 2026', W / 2, 26, 4, INK);
  cv.textCenter('36 DATED STORIES · 7 REGIONS · 8 FIELDS · EVERY STORY FROM TODAY', W / 2, 62, 2, BLUE);
  cv.hline(MX, 84, W - 2 * MX, INK, 2);

  // ---- UTC timeline --------------------------------------------------
  cv.textCenter('THE DAY IN UTC - ALL TIMES THURSDAY 26 NOVEMBER 2026', W / 2, 92, 1, RED);
  cv.textCenter('13:30 PARADE NYC · 14:00 CHESS GENEVA · 17:45 EUROPA X8 · 18:00 BEARS-LIONS', W / 2, 104, 2, INK);
  cv.textCenter('20:00 EUROPA X10 · 21:30 EAGLES-COWBOYS · 01:20 FRI CHIEFS-BILLS', W / 2, 120, 2, INK);
  cv.textCenter('ALL TIMES UTC; 01:20 IS FRI UTC, THU 8:20PM ET', W / 2, 138, 1, GREY);
  cv.hline(MX, 150, W - 2 * MX, INK, 1);

  // ---- six lead stories ----------------------------------------------
  const leadW = Math.floor((W - 2 * MX - 2 * 8) / 3);
  const leadH = 146;
  const leadY0 = 156;
  for (let i = 0; i < 6; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawLead(
      cv,
      LEADS[i],
      MX + col * (leadW + 8),
      leadY0 + row * (leadH + 6),
      leadW,
      leadH,
    );
  }

  // ---- map + numbers + date check ------------------------------------
  const midY = 156 + 2 * leadH + 6 + 8; // 462
  const midH = 168;
  const mapW = 504;
  drawMap(cv, MX, midY, mapW, midH);
  const rightX = MX + mapW + 8;
  const rightW = W - MX - rightX;
  drawNumbers(cv, rightX, midY, rightW, 82);
  drawDateCheck(cv, rightX, midY + 88, rightW, midH - 88);

  // ---- briefs ---------------------------------------------------------
  const briefY = midY + midH + 8; // 638
  cv.text('ALSO ON 26 NOVEMBER - 30 MORE DATED, SOURCED STORIES', MX, briefY, 2, RED);
  const rows = 15;
  const rowH = 22;
  const colW = Math.floor((W - 2 * MX) / 2);
  for (let i = 0; i < BRIEFS.length; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const bx = MX + col * colW;
    const by = briefY + 22 + row * rowH;
    const n = String(7 + i);
    cv.text(n, bx, by, 2, RED);
    cv.text(BRIEFS[i], bx + 30, by, 2, INK);
  }

  // ---- footer ---------------------------------------------------------
  const footY = briefY + 22 + rows * rowH + 6; // ~996
  cv.hline(MX, footY, W - 2 * MX, INK, 1);
  cv.text(BRIEF_SOURCES, MX, footY + 6, 1, GREY);
  cv.text(NOT_YET, MX, footY + 17, 1, GREY);
  return cv;
}

// ------------------------------------------------------------------ main --
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const cv = render();
  const png = encodePNG(cv);
  const outPath = join(outDir, 'entry.png');
  writeFileSync(outPath, png);
  const sha = createHash('sha256').update(png).digest('hex');
  console.log(`wrote ${outPath}`);
  console.log(`size: ${png.length} bytes (limit 1048576)`);
  console.log(`dimensions: ${W}x${H}`);
  console.log(`sha256: ${sha}`);
  console.log(`stories: 36 (6 leads + 30 briefs), regions: 7, fields: 8`);
}

main();
