#!/usr/bin/env python3
"""Package favicon A's three PNGs into one .ico, and verify it. Python standard library only (zlib, struct).

  python3 -I docs/ui/favicon-a/pack_ico.py pack   apps/web/public/favicon.ico apps/web/public/favicon-{16,32,48}.png
  python3 -I docs/ui/favicon-a/pack_ico.py verify apps/web/public/favicon.ico apps/web/public/favicon-{16,32,48}.png

Each frame is a 32-bit BGRA DIB (BITMAPINFOHEADER, height doubled, bottom-up rows) plus a 1-bit AND mask that is set
where alpha == 0: the classic ICO frame every browser and Windows reads. Pixels are copied unchanged from the PNGs
(straight alpha, no resampling, no colour change). `verify` decodes the .ico back and compares every RGBA pixel.
"""
import struct
import sys
import zlib


def read_png(path):
    """Decode an 8-bit, non-interlaced RGBA PNG to (width, height, rows of RGBA bytes)."""
    data = open(path, 'rb').read()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'{path}: not a PNG')
    pos, idat, ihdr = 8, b'', None
    while pos < len(data):
        n, kind = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if zlib.crc32(kind + body) & 0xFFFFFFFF != struct.unpack('>I', data[pos + 8 + n:pos + 12 + n])[0]:
            raise SystemExit(f'{path}: bad CRC in {kind!r}')
        if kind == b'IHDR':
            ihdr = struct.unpack('>IIBBBBB', body)
        elif kind == b'IDAT':
            idat += body
        elif kind == b'IEND':
            break
        pos += 12 + n
    w, h, depth, ctype, _, _, interlace = ihdr
    if (depth, ctype, interlace) != (8, 6, 0):
        raise SystemExit(f'{path}: need 8-bit RGBA non-interlaced, got depth={depth} type={ctype} interlace={interlace}')
    raw, bpp, stride = zlib.decompress(idat), 4, w * 4
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f, line = raw[i], bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
            elif f != 0:
                raise SystemExit(f'{path}: bad filter {f}')
        rows.append(bytes(line)); prev = line
    return w, h, rows


def frame(w, h, rows):
    """BITMAPINFOHEADER + bottom-up BGRA + AND mask (1 = transparent), rows padded to 4 bytes."""
    xor = b''.join(bytes(v for px in range(w) for v in (r[px * 4 + 2], r[px * 4 + 1], r[px * 4], r[px * 4 + 3])) for r in reversed(rows))
    mask_stride = ((w + 31) // 32) * 4
    mask = b''
    for r in reversed(rows):
        bits = bytearray(mask_stride)
        for px in range(w):
            if r[px * 4 + 3] == 0:
                bits[px // 8] |= 0x80 >> (px % 8)
        mask += bytes(bits)
    header = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0, len(xor) + len(mask), 0, 0, 0, 0)
    return header + xor + mask


def pack(out, pngs):
    images = [read_png(p) for p in pngs]
    frames = [frame(*img) for img in images]
    offset = 6 + 16 * len(frames)
    head = struct.pack('<HHH', 0, 1, len(frames))
    for (w, h, _), f in zip(images, frames):
        head += struct.pack('<BBBBHHII', w % 256, h % 256, 0, 0, 1, 32, len(f), offset)
        offset += len(f)
    open(out, 'wb').write(head + b''.join(frames))
    print(f'wrote {out}: {len(frames)} frames ' + ', '.join(f'{w}x{h}' for w, h, _ in images))


def read_ico(path):
    data = open(path, 'rb').read()
    reserved, kind, count = struct.unpack('<HHH', data[:6])
    if (reserved, kind) != (0, 1):
        raise SystemExit(f'{path}: not an ICO')
    out = []
    for k in range(count):
        w, h, colors, _, planes, bits, size, off = struct.unpack('<BBBBHHII', data[6 + 16 * k:22 + 16 * k])
        w, h = w or 256, h or 256
        hs, bw, bh, _, bc, comp = struct.unpack('<IiiHHI', data[off:off + 20])
        if (hs, bw, bh, bc, comp, bits, planes, colors) != (40, w, h * 2, 32, 0, 32, 1, 0):
            raise SystemExit(f'{path}: frame {k} is not a 32-bit BI_RGB DIB of {w}x{h}')
        px = data[off + 40:off + 40 + w * h * 4]
        rows = [bytes(v for i in range(w) for v in (r[i * 4 + 2], r[i * 4 + 1], r[i * 4], r[i * 4 + 3])) for r in (px[y * w * 4:(y + 1) * w * 4] for y in range(h))]
        out.append((w, h, list(reversed(rows)), size))
    return out


def verify(ico, pngs):
    frames, ok = read_ico(ico), True
    print(f'{ico}: {len(frames)} frames ' + ', '.join(f'{w}x{h}' for w, h, _, _ in frames))
    ok &= len(frames) == len(pngs)
    for (w, h, rows, size), p in zip(frames, pngs):
        pw, ph, prow = read_png(p)
        same = (w, h) == (pw, ph) and rows == prow
        alphas = [r[i * 4 + 3] for r in rows for i in range(w)]
        corners = [rows[y][x * 4 + 3] for y in (0, h - 1) for x in (0, w - 1)]
        print(f'  {w}x{h} vs {p}: pixels identical={same}; alpha 0={alphas.count(0)} partial={sum(0 < a < 255 for a in alphas)} opaque={alphas.count(255)}; corner alphas={corners}')
        ok &= same and all(a == 0 for a in corners) and alphas.count(0) > 0
    print('VERIFY OK' if ok else 'VERIFY FAILED')
    return ok


if __name__ == '__main__':
    cmd, ico, *pngs = sys.argv[1:]
    if cmd == 'pack':
        pack(ico, pngs)
    elif cmd == 'verify':
        sys.exit(0 if verify(ico, pngs) else 1)
    else:
        raise SystemExit('usage: pack|verify OUT.ico A-16.png A-32.png A-48.png')
