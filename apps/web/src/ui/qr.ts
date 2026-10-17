// Minimal QR encoder (byte mode, error-correction level M, versions 1–10) — original implementation for Moonveil,
// no dependency. Returns a square boolean matrix (true = dark). Spec: ISO/IEC 18004. Licence: Moonveil (original).
const EC_M: [number, number, number, number][] = [
  // version 1..10 at level M: [ecPerBlock, blocksG1, dataG1, blocksG2] (G2 blocks carry dataG1+1 codewords)
  [10, 1, 16, 0], [16, 1, 28, 0], [26, 1, 44, 0], [18, 2, 32, 0], [24, 2, 43, 0],
  [16, 4, 27, 0], [18, 4, 31, 0], [22, 2, 38, 2], [22, 3, 36, 2], [26, 4, 43, 1],
];
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// GF(256) tables for Reed–Solomon (primitive polynomial 0x11d).
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a]! + LOG[b]!]! : 0);
function rsGenerator(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] = (next[j] ?? 0) ^ g[j]!; next[j + 1] = (next[j + 1] ?? 0) ^ mul(g[j]!, EXP[i]!); }
    g = next;
  }
  return g;
}
function rsEncode(data: number[], n: number): number[] {
  const g = rsGenerator(n);
  const r = new Array<number>(n).fill(0);
  for (const d of data) {
    const f = d ^ r[0]!;
    r.shift(); r.push(0);
    if (f) for (let j = 0; j < n; j++) r[j] = (r[j] ?? 0) ^ mul(g[j + 1]!, f);
  }
  return r;
}

function dataCapacity(v: number): number { const [ec, b1, d1, b2] = EC_M[v - 1]!; return b1 * d1 + b2 * (d1 + 1) + 0 * ec; }

export function qrEncode(text: string): { matrix: boolean[][]; version: number; reserved: boolean[][] } {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 0;
  for (let v = 1; v <= 10; v++) { const cap = dataCapacity(v); const overhead = v < 10 ? 2 : 3; if (bytes.length + overhead + 1 <= cap + 1 && bytes.length <= cap - overhead) { version = v; break; } }
  if (!version) throw new Error('qr: text too long');
  const [ecN, b1, d1, b2] = EC_M[version - 1]!;
  const totalData = b1 * d1 + b2 * (d1 + 1);
  // bit stream: mode 0100, count (8 bits for v<10, 16 for v10), data, terminator, pad
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4); push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  for (let i = 0; i < 4 && bits.length < totalData * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0; data.length < totalData; p++) data.push(p % 2 ? 0x11 : 0xec);
  // blocks + interleave
  const blocks: number[][] = [], ecs: number[][] = [];
  let off = 0;
  for (let i = 0; i < b1 + b2; i++) { const len = i < b1 ? d1 : d1 + 1; const blk = data.slice(off, off + len); off += len; blocks.push(blk); ecs.push(rsEncode(blk, ecN)); }
  const out: number[] = [];
  const maxLen = d1 + (b2 ? 1 : 0);
  for (let i = 0; i < maxLen; i++) for (const blk of blocks) if (i < blk.length) out.push(blk[i]!);
  for (let i = 0; i < ecN; i++) for (const e of ecs) out.push(e[i]!);
  // matrix
  const n = version * 4 + 17;
  const m: (boolean | null)[][] = Array.from({ length: n }, () => Array<boolean | null>(n).fill(null));
  const set = (r: number, c: number, v: boolean) => { if (r >= 0 && c >= 0 && r < n && c < n) m[r]![c] = v; };
  const finder = (r: number, c: number) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const inB = i >= 0 && j >= 0 && i <= 6 && j <= 6; const ring = inB && (i === 0 || i === 6 || j === 0 || j === 6); const core = inB && i >= 2 && i <= 4 && j >= 2 && j <= 4; set(r + i, c + j, ring || core); } };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { if (m[6]![i] === null) m[6]![i] = i % 2 === 0; if (m[i]![6] === null) m[i]![6] = i % 2 === 0; }
  for (const a of ALIGN[version - 1]!) for (const b of ALIGN[version - 1]!) {
    if ((a <= 8 && b <= 8) || (a <= 8 && b >= n - 9) || (a >= n - 9 && b <= 8)) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(a + i, b + j, Math.max(Math.abs(i), Math.abs(j)) !== 1);
  }
  // reserve format areas (+ dark module)
  for (let i = 0; i < 9; i++) { if (m[8]![i] === null) m[8]![i] = false; if (m[i]![8] === null) m[i]![8] = false; }
  for (let i = 0; i < 8; i++) { if (m[8]![n - 1 - i] === null) m[8]![n - 1 - i] = false; if (m[n - 1 - i]![8] === null) m[n - 1 - i]![8] = false; }
  m[n - 8]![8] = true;
  if (version >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { m[i]![n - 11 + j] = false; m[n - 11 + j]![i] = false; }
  // place data (zigzag), remember which modules are data for masking
  const isData: boolean[][] = m.map((row) => row.map((v) => v === null));
  const reserved = isData.map((row) => row.map((v) => !v));
  let bi = 0, up = true;
  const dataBits: number[] = []; for (const b of out) for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1);
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < n; k++) { const r = up ? n - 1 - k : k; for (const c of [col, col - 1]) if (m[r]![c] === null) { m[r]![c] = (dataBits[bi++] ?? 0) === 1; } }
    up = !up;
  }
  const masks: ((r: number, c: number) => boolean)[] = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (_, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];
  const applyMask = (k: number): boolean[][] => m.map((row, r) => row.map((v, c) => (isData[r]![c] ? (v as boolean) !== masks[k]!(r, c) : (v as boolean))));
  const writeFormat = (g: boolean[][], k: number) => {
    const fmt = (0b00 << 3) | k; // level M = 00
    let v = fmt << 10; for (let i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0x537 << (i - 10);
    const bitsF = ((fmt << 10) | v) ^ 0x5412;
    const bit = (i: number) => ((bitsF >> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) g[8]![i] = bit(14 - i);
    g[8]![7] = bit(8); g[8]![8] = bit(7); g[7]![8] = bit(6);
    for (let i = 0; i <= 5; i++) g[i]![8] = bit(i);
    for (let i = 0; i <= 6; i++) g[n - 1 - i]![8] = bit(14 - i);
    for (let i = 0; i <= 7; i++) g[8]![n - 8 + i] = bit(7 - i);
    g[n - 8]![8] = true;
    if (version >= 7) {
      let vv = version << 12; for (let i = 17; i >= 12; i--) if (vv & (1 << i)) vv ^= 0x1f25 << (i - 12);
      const vb = (version << 12) | vv;
      for (let i = 0; i < 18; i++) { const b = ((vb >> i) & 1) === 1; g[Math.floor(i / 3)]![n - 11 + (i % 3)] = b; g[n - 11 + (i % 3)]![Math.floor(i / 3)] = b; }
    }
  };
  const penalty = (g: boolean[][]) => {
    let p = 0;
    const run = (get: (i: number, j: number) => boolean) => { for (let i = 0; i < n; i++) { let cnt = 1; for (let j = 1; j < n; j++) { if (get(i, j) === get(i, j - 1)) { cnt++; if (cnt === 5) p += 3; else if (cnt > 5) p++; } else cnt = 1; } } };
    run((i, j) => g[i]![j]!); run((i, j) => g[j]![i]!);
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const v = g[i]![j]; if (v === g[i]![j + 1] && v === g[i + 1]![j] && v === g[i + 1]![j + 1]) p += 3; }
    const pat = [true, false, true, true, true, false, true, false, false, false, false], pat2 = [...pat].reverse();
    const scan = (get: (i: number, j: number) => boolean) => { for (let i = 0; i < n; i++) for (let j = 0; j + 11 <= n; j++) { let a = true, b = true; for (let k = 0; k < 11; k++) { if (get(i, j + k) !== pat[k]) a = false; if (get(i, j + k) !== pat2[k]) b = false; } if (a || b) p += 40; } };
    scan((i, j) => g[i]![j]!); scan((i, j) => g[j]![i]!);
    let dark = 0; for (const row of g) for (const v of row) if (v) dark++;
    p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
    return p;
  };
  let best: boolean[][] | null = null, bestP = Infinity;
  for (let k = 0; k < 8; k++) { const g = applyMask(k); writeFormat(g, k); const p = penalty(g); if (p < bestP) { bestP = p; best = g; } }
  return { matrix: best!, version, reserved };
}

export function qrMatrix(text: string): boolean[][] {
  return qrEncode(text).matrix;
}

/** SVG path string for a matrix (1 unit per module), for an inline <svg viewBox="0 0 n n">. */
export function qrPath(mat: boolean[][]): string {
  let d = '';
  mat.forEach((row, r) => row.forEach((v, c) => { if (v) d += `M${c} ${r}h1v1h-1z`; }));
  return d;
}
