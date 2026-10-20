"""Standard-library checks for review PNGs, no installs."""
from pathlib import Path
import struct, zlib
root=Path(__file__).resolve().parent
for key in ('a','b'):
    for size in (16,32,48):
        path=root/f'alternative-{key}-{size}.png'
        data=path.read_bytes()
        assert data[:8]==b'\x89PNG\r\n\x1a\n'
        pos=8; packed=b''
        while pos<len(data):
            n=struct.unpack_from('>I',data,pos)[0]
            kind,body=data[pos+4:pos+8],data[pos+8:pos+8+n]
            assert zlib.crc32(kind+body)==struct.unpack_from('>I',data,pos+8+n)[0]
            if kind==b'IHDR':
                w,h,depth,color,_,_,inter=struct.unpack('>IIBBBBB',body)
                assert (w,h,depth,color,inter)==(size,size,8,6,0)
            if kind==b'IDAT': packed+=body
            pos+=12+n
        raw=zlib.decompress(packed); stride=size*4; prev=bytearray(stride); rows=[]
        for y in range(size):
            method=raw[y*(stride+1)]; row=bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
            for x in range(stride):
                a=row[x-4] if x>=4 else 0; b=prev[x]; c=prev[x-4] if x>=4 else 0
                p=a+b-c
                paeth=min((abs(p-a),0,a),(abs(p-b),1,b),(abs(p-c),2,c))[2]
                row[x]=(row[x]+[0,a,b,(a+b)//2,paeth][method])&255
            rows.append(row);prev=row
        alphas=[row[x*4+3] for row in rows for x in range(size)]
        assert min(alphas)==0 and max(alphas)==255
        assert rows[0][3]==0 and rows[-1][-1]==0
        opaque=[(x,y) for y,row in enumerate(rows) for x in range(size) if row[x*4+3]>=128]
        bounds=(min(x for x,y in opaque),min(y for x,y in opaque),max(x for x,y in opaque),max(y for x,y in opaque))
        print(path.name,'RGBA/CRC/transparent corners OK; alpha>=128 bounds',bounds)
print('Six candidate PNG checks passed.')
