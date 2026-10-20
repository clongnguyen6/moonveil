import AppKit
let root = URL(fileURLWithPath: "docs/visual/icon/favicon-v2")
func color(_ h: UInt32) -> NSColor { NSColor(srgbRed: CGFloat((h>>16)&255)/255, green: CGFloat((h>>8)&255)/255, blue: CGFloat(h&255)/255, alpha: 1) }
func canvas(_ w: Int,_ h: Int,_ f: ()->Void) -> NSBitmapImageRep {
 let r = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:w,pixelsHigh:h,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:r); NSGraphicsContext.current!.imageInterpolation = .high; f(); NSGraphicsContext.restoreGraphicsState(); return r
}
func image(_ r:NSBitmapImageRep)->NSImage { let i=NSImage(size:NSSize(width:r.pixelsWide,height:r.pixelsHigh));i.addRepresentation(r);return i }
func save(_ r:NSBitmapImageRep,_ name:String) throws {try r.representation(using:.png,properties:[:])!.write(to:root.appendingPathComponent(name))}
var icons:[String:[Int:NSImage]]=[:]
for key in ["a","b"] {
 let input = NSImage(contentsOf:root.appendingPathComponent("alternative-\(key)-master.png"))!
 let raw = canvas(1280,1280){input.draw(in:NSRect(x:0,y:0,width:1280,height:1280))}
 let w=raw.pixelsWide,h=raw.pixelsHigh
 func alpha(_ x:Int,_ y:Int)->CGFloat {CGFloat(raw.bitmapData![y*raw.bytesPerRow+x*4+3])/255}
 func rgba(_ x:Int,_ y:Int)->NSColor {let p=raw.bitmapData!+y*raw.bytesPerRow+x*4;let a=max(1,CGFloat(p[3]));return NSColor(srgbRed:min(1,CGFloat(p[0])/a),green:min(1,CGFloat(p[1])/a),blue:min(1,CGFloat(p[2])/a),alpha:CGFloat(p[3])/255)}
 var outside=Array(repeating:false,count:w*h), queue:[Int]=[]
 // Flood-fill transparent exterior; enclosed alpha holes in B are generation artifacts.
 func visit(_ x:Int,_ y:Int) {if x<0 || y<0 || x>=w || y>=h{return};let n=y*w+x;if !outside[n] && alpha(x,y)<0.5 {outside[n]=true;queue.append(n)}}
 for x in 0..<w {visit(x,0);visit(x,h-1)};for y in 0..<h {visit(0,y);visit(w-1,y)}
 var q=0
 while q<queue.count {let n=queue[q];q+=1;let x=n%w,y=n/w;visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1)}
 var minX=w,minY=h,maxX=0,maxY=0
 let clean = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:w,pixelsHigh:h,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 for y in 0..<h {for x in 0..<w {
  let c=rgba(x,y)
  if c.alphaComponent<0.5 && (key=="a" || outside[y*w+x]) {let p=clean.bitmapData!+y*clean.bytesPerRow+x*4;p[0]=0;p[1]=0;p[2]=0;p[3]=0;continue}
  let fill:NSColor
  if c.alphaComponent<0.5 {fill=color(0x173b3b)}
  else if c.redComponent>0.65 && c.greenComponent>0.66 && c.blueComponent>0.40 {fill=color(0xf5e5b8)}
  else if c.redComponent>0.55 && c.greenComponent>0.22 {fill=color(0xe99a23)}
  else {fill=color(0x173b3b)}
  let p=clean.bitmapData!+y*clean.bytesPerRow+x*4;p[0]=UInt8((fill.redComponent*255).rounded());p[1]=UInt8((fill.greenComponent*255).rounded());p[2]=UInt8((fill.blueComponent*255).rounded());p[3]=255;minX=min(minX,x);maxX=max(maxX,x);minY=min(minY,y);maxY=max(maxY,y)
 }}
 try save(clean,"alternative-\(key)-clean.png")
 let src=image(clean)
 let crop=NSRect(x:minX,y:h-1-maxY,width:maxX-minX+1,height:maxY-minY+1)
 icons[key]=[:]
 for size in [16,32,48] {
  let scale=Double(size)*0.9375/max(crop.width,crop.height)
  let dw=crop.width*scale,dh=crop.height*scale
  let out=canvas(size,size){src.draw(in:NSRect(x:(Double(size)-dw)/2,y:(Double(size)-dh)/2,width:dw,height:dh),from:crop,operation:.sourceOver,fraction:1)}
  try save(out,"alternative-\(key)-\(size).png");icons[key]![size]=image(out)
 }
 print("\(key): generated \(w)x\(h), cleaned bounds \(minX),\(minY)..\(maxX),\(maxY); symbol long axis 93.75%")
}
icons["current"]=[:]
for size in [16,32,48] {icons["current"]![size]=NSImage(contentsOfFile:"docs/visual/icon/export/favicon-\(size).png")!}
let W=1120,H=790
let board=canvas(W,H){
 func r(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat)->NSRect{NSRect(x:x,y:CGFloat(H)-y-h,width:w,height:h)}
 func fill(_ c:NSColor,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat){c.setFill();r(x,y,w,h).fill()}
 func text(_ s:String,_ x:CGFloat,_ y:CGFloat,_ c:NSColor,_ z:CGFloat=14){(s as NSString).draw(in:r(x,y,1000,25),withAttributes:[.font:NSFont.systemFont(ofSize:z),.foregroundColor:c])}
 func icon(_ k:String,_ size:Int,_ x:CGFloat,_ y:CGFloat){icons[k]![size]!.draw(in:r(x,y,CGFloat(size),CGFloat(size)))}
 fill(color(0xdde3e2),0,0,CGFloat(W),CGFloat(H));text("Moonveil / favicon A-B review",24,16,color(0x173b3b),23)
 text("Native pixels at 100% • current / A transparent / B rounded plate • local AppKit mock, no browser render",24,48,color(0x173b3b))
 for (i,bg) in [UInt32(0xffffff),0x171b22,0xe9edf3].enumerated(){
  let x=CGFloat(20+i*368),fg=color(i==1 ? 0xf2f3ee:0x253434)
  fill(color(bg),x,92,352,670)
  text(["Light","Dark","Browser-like cool grey"][i],x+14,104,fg,17)
  for (j,k) in ["current","a","b"].enumerated(){
   let y=CGFloat(150+j*62)
   text(["Current","A · transparent","B · rounded"][j],x+14,y+8,fg)
   icon(k,16,x+164,y+10);icon(k,32,x+214,y+2);icon(k,48,x+280,y-6)
  }
  text("16 px                32 px             48 px",x+148,345,fg,11)
  text("Mock vertical strips • generic neighbours",x+14,393,fg,13)
  for (j,k) in ["current","a","b"].enumerated(){
   let bx=x+14+CGFloat(j)*110
   text(["Current","A","B"][j],bx,423,fg,12)
   fill(color(i==1 ? 0x292f3a:0xd9dfe8),bx,452,96,264)
   for (row,sz) in [16,16,16,16,32,32].enumerated(){
    let yy=CGFloat(466+row*39),xx=bx+12
    if row==1 || row==4 {icon(k,sz,xx,yy)} else {
     color(row%2==0 ? 0x5d92dc:0xd77965).setFill()
     if row%2==0 {NSBezierPath(ovalIn:r(xx,yy,CGFloat(sz),CGFloat(sz))).fill()} else {
      let p=NSBezierPath();p.move(to:NSPoint(x:xx+CGFloat(sz)/2,y:CGFloat(H)-yy));p.line(to:NSPoint(x:xx+CGFloat(sz),y:CGFloat(H)-yy-CGFloat(sz)));p.line(to:NSPoint(x:xx,y:CGFloat(H)-yy-CGFloat(sz)));p.close();p.fill()
     }
    }
    fill(color(i==1 ? 0x697385:0xa2acbb),bx+52,yy+6,30,3)
   }
  }
 }
}
try save(board,"comparison-sheet.png")
print("Saved true-size comparison and six candidate PNGs. No adoption or app writes.")
