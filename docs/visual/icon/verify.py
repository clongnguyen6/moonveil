"""Dependency-free asset format/pixel checks. Reads only this icon directory."""
import pathlib
import struct
import zlib

root = pathlib.Path(__file__).resolve().parent

def png(path):
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', path
    pos, packed = 8, bytearray()
    while pos < len(data):
        size = struct.unpack_from('>I', data, pos)[0]
        kind, body = data[pos+4:pos+8], data[pos+8:pos+8+size]
        crc = struct.unpack_from('>I', data, pos+8+size)[0]
        assert zlib.crc32(kind+body) == crc, path
        if kind == b'IHDR':
            w,h,depth,color,comp,filt,inter = struct.unpack('>IIBBBBB', body)
        if kind == b'IDAT': packed.extend(body)
        pos += 12+size
    assert pos == len(data) and depth == 8 and color == 6 and inter == 0, path
    raw = zlib.decompress(packed)
    stride = w*4
    assert len(raw) == (stride+1)*h, path
    prev, pixels = bytearray(stride), []
    for y in range(h):
        method = raw[y*(stride+1)]
        row = bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        for i in range(stride):
            a = row[i-4] if i >= 4 else 0
            b, c = prev[i], prev[i-4] if i >= 4 else 0
            if method == 0: predictor = 0
            elif method == 1: predictor = a
            elif method == 2: predictor = b
            elif method == 3: predictor = (a+b)//2
            elif method == 4:
                p = a+b-c
                predictor = min([(abs(p-a),0,a), (abs(p-b),1,b), (abs(p-c),2,c)])[2]
            else: raise AssertionError(method)
            row[i] = (row[i]+predictor) & 255
        assert all(alpha == 255 for alpha in row[3::4]), path
        pixels.append(row)
        prev = row
    return w,h,pixels

expected = {'favicon-16.png':16, 'favicon-32.png':32, 'favicon-48.png':48,
            'apple-touch-icon.png':180, 'icon-192.png':192, 'icon-512.png':512}
frames = {}
for name, size in expected.items():
    w,h,pixels = png(root/'export'/name)
    assert (w,h) == (size,size)
    frames[size] = pixels
    print(f'{name}: {w}×{h}, CRCs valid, fully opaque')
for name, size in [('master-padded.png',(1254,1254)), ('preview-sheet.png',(1480,1120))]:
    w,h,_ = png(root/name)
    assert (w,h) == size
    print(f'{name}: {w}×{h}, CRCs valid, fully opaque')

ico = (root/'export/favicon.ico').read_bytes()
assert struct.unpack_from('<HHH', ico) == (0,1,3)
end = 54
for i,size in enumerate([16,32,48]):
    w,h,colors,reserved,planes,bits,length,offset = struct.unpack_from('<BBBBHHII',ico,6+i*16)
    assert (w,h,planes,bits,offset) == (size,size,1,32,end)
    dib = ico[offset:offset+length]
    assert struct.unpack_from('<IiiHHI',dib) == (40,size,size*2,1,32,0)
    assert length == 40 + size*size*4 + ((size+31)//32)*4*size
    assert not any(dib[40+size*size*4:])
    for y in range(size):
        row = frames[size][size-1-y]
        for x in range(size):
            r,g,b,a = row[x*4:x*4+4]
            assert dib[40+(y*size+x)*4:44+(y*size+x)*4] == bytes([b,g,r,a])
    end += length
    print(f'ICO {size}×{size}: valid DIB, opaque mask, exact PNG pixel match')
assert end == len(ico)
print('All asset checks passed.')
