// Structural self-test for the vendored QR encoder (no decoder available offline): reads the symbol back the way a
// reader does — format info (BCH), unmask, zigzag read, de-interleave, Reed–Solomon syndromes = 0, bytes == input.
//   node scripts/env.mjs node apps/web/src/ui/dev/qr-selftest.mjs
import { qrEncode } from '../qr.ts';

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
const EC_M = [[10, 1, 16, 0], [16, 1, 28, 0], [26, 1, 44, 0], [18, 2, 32, 0], [24, 2, 43, 0], [16, 4, 27, 0], [18, 4, 31, 0], [22, 2, 38, 2], [22, 3, 36, 2], [26, 4, 43, 1]];
const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const masks = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (_, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];

function check(text) {
  const { matrix: m, reserved } = qrEncode(text); const n = m.length; const version = (n - 17) / 4;
  const problems = [];
  // finder patterns
  const finderOk = (r0, c0) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const ring = i === 0 || i === 6 || j === 0 || j === 6; const core = i >= 2 && i <= 4 && j >= 2 && j <= 4; if (m[r0 + i][c0 + j] !== (ring || core)) return false; } return true; };
  if (!finderOk(0, 0) || !finderOk(0, n - 7) || !finderOk(n - 7, 0)) problems.push('finder');
  // format info: read 15 bits, unmask, BCH check, extract mask
  // read the 15 format bits in the zxing reader's order (MSB first): (8,0..5), (8,7), (8,8), (7,8), (5..0,8); copy 2: (n-1..n-7,8), (8,n-8..n-1)
  const rd = (r, c) => (m[r][c] ? 1 : 0);
  let f = 0; for (let i = 0; i <= 5; i++) f = (f << 1) | rd(8, i); f = (f << 1) | rd(8, 7); f = (f << 1) | rd(8, 8); f = (f << 1) | rd(7, 8); for (let i = 5; i >= 0; i--) f = (f << 1) | rd(i, 8);
  let f2 = 0; for (let i = n - 1; i >= n - 7; i--) f2 = (f2 << 1) | rd(i, 8); for (let i = n - 8; i < n; i++) f2 = (f2 << 1) | rd(8, i);
  if (f !== f2) problems.push('format copies differ');
  const fu = f ^ 0x5412; let rem = fu; for (let i = 14; i >= 10; i--) if (rem & (1 << i)) rem ^= 0x537 << (i - 10);
  if (rem !== 0) problems.push('format BCH');
  const level = (fu >> 13) & 3, mask = (fu >> 10) & 7;
  if (level !== 0) problems.push('level != M');
  // function-pattern map: independent expectation vs the encoder's reserved map
  const fn = Array.from({ length: n }, () => Array(n).fill(false));
  const mark = (r, c) => { if (r >= 0 && c >= 0 && r < n && c < n) fn[r][c] = true; };
  for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { mark(i, j); mark(i, n - 7 + j); mark(n - 7 + i, j); }
  for (let i = 0; i < n; i++) { mark(6, i); mark(i, 6); }
  for (const a of ALIGN[version - 1]) for (const b of ALIGN[version - 1]) { if ((a <= 8 && b <= 8) || (a <= 8 && b >= n - 9) || (a >= n - 9 && b <= 8)) continue; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) mark(a + i, b + j); }
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); } for (let i = 0; i < 8; i++) { mark(8, n - 1 - i); mark(n - 1 - i, 8); }
  if (version >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { mark(i, n - 11 + j); mark(n - 11 + j, i); }
  let diff = 0; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (fn[r][c] !== reserved[r][c]) diff++;
  if (diff) problems.push(`reserved map differs in ${diff} modules`);
  // read data bits (zigzag), unmasked
  const bits = []; let up = true;
  for (let col = n - 1; col > 0; col -= 2) { if (col === 6) col--; for (let k = 0; k < n; k++) { const r = up ? n - 1 - k : k; for (const c of [col, col - 1]) if (!fn[r][c]) bits.push((m[r][c] !== masks[mask](r, c)) ? 1 : 0); } up = !up; }
  const [ecN, b1, d1, b2] = EC_M[version - 1]; const total = b1 * d1 + b2 * (d1 + 1) + (b1 + b2) * ecN;
  const cw = []; for (let i = 0; i + 8 <= bits.length && cw.length < total; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  if (cw.length !== total) problems.push(`codewords ${cw.length}!=${total}`);
  // de-interleave
  const blocks = []; for (let i = 0; i < b1 + b2; i++) blocks.push({ data: [], ec: [] });
  const maxLen = d1 + (b2 ? 1 : 0); let p = 0;
  for (let i = 0; i < maxLen; i++) for (let bi = 0; bi < blocks.length; bi++) { const len = bi < b1 ? d1 : d1 + 1; if (i < len) blocks[bi].data.push(cw[p++]); }
  for (let i = 0; i < ecN; i++) for (const b of blocks) b.ec.push(cw[p++]);
  for (const [i, b] of blocks.entries()) { const poly = [...b.data, ...b.ec]; for (let s = 0; s < ecN; s++) { let v = 0; for (const c of poly) v = mul(v, EXP[s]) ^ c; if (v !== 0) { problems.push(`RS syndrome block ${i}`); break; } } }
  // data readback
  const data = blocks.flatMap((b) => b.data); const db = data.flatMap((x) => [...Array(8)].map((_, i) => (x >> (7 - i)) & 1));
  const mode = parseInt(db.slice(0, 4).join(''), 2); const cl = version < 10 ? 8 : 16; const count = parseInt(db.slice(4, 4 + cl).join(''), 2);
  const bytes = []; for (let i = 0; i < count; i++) bytes.push(parseInt(db.slice(4 + cl + i * 8, 4 + cl + i * 8 + 8).join(''), 2));
  const got = new TextDecoder().decode(new Uint8Array(bytes));
  if (mode !== 4 || got !== text) problems.push(`payload mismatch: ${JSON.stringify(got).slice(0, 40)}`);
  return { version, n, problems };
}
let fails = 0;
for (const t of ['http://192.168.1.23:4100/r/ABCDEF', 'MOONVEIL', 'https://moonveil.example/r/QWERTY?x=1&y=22222222222222222222', 'a'.repeat(100), 'b'.repeat(200), 'https://xn--ngvi-1ta.example/r/ẮBCDEF']) {
  const r = check(t); const ok = r.problems.length === 0; if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  v${r.version} ${t.slice(0, 32)}${r.problems.length ? '  ' + r.problems.join(', ') : ''}`);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
