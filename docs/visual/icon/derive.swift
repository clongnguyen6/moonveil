// Run from the worktree root. AppKit derives sizes; all artwork comes from master.png.
import AppKit

let root = URL(fileURLWithPath: "docs/visual/icon", isDirectory: true)
let source = NSImage(contentsOf: root.appendingPathComponent("master.png"))!
func rgb(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255)/255, green: CGFloat((hex >> 8) & 255)/255, blue: CGFloat(hex & 255)/255, alpha: 1)
}
func canvas(_ w: Int, _ h: Int, _ render: () -> Void) -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current!.imageInterpolation = .high
    render()
    NSGraphicsContext.restoreGraphicsState()
    return rep
}
func save(_ rep: NSBitmapImageRep, _ name: String) throws {
    try rep.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent(name))
}
func asImage(_ rep: NSBitmapImageRep) -> NSImage {
    let image = NSImage(size: NSSize(width: rep.pixelsWide, height: rep.pixelsHigh))
    image.addRepresentation(rep)
    return image
}
// Original edge is midnight teal; full opaque plate, no baked-in rounded corners.
let plate = rgb(0x172f34)
let padded = canvas(1254, 1254) {
    plate.setFill(); NSRect(x: 0, y: 0, width: 1254, height: 1254).fill()
    // Preserve the generated composition, including its original margins.
    source.draw(in: NSRect(x: 62.7, y: 62.7, width: 1128.6, height: 1128.6))
}
try save(padded, "master-padded.png")
let master = asImage(padded)
let sizes = [16, 32, 48, 180, 192, 512]
var reps: [Int: NSBitmapImageRep] = [:]
for size in sizes {
    let rep = canvas(size, size) { master.draw(in: NSRect(x: 0, y: 0, width: size, height: size)) }
    reps[size] = rep
    let name: String
    switch size {
    case 16: name = "favicon-16.png"
    case 32: name = "favicon-32.png"
    case 48: name = "favicon-48.png"
    case 180: name = "apple-touch-icon.png"
    default: name = "icon-\(size).png"
    }
    try save(rep, "export/" + name)
}
// ICO: Windows DIB/BGRA entries + AND masks (widely compatible small sizes).
func le16(_ n: Int) -> Data { Data([UInt8(n & 255), UInt8((n >> 8) & 255)]) }
func le32(_ n: Int) -> Data { Data((0..<4).map { UInt8((n >> ($0*8)) & 255) }) }
var payloads: [Data] = []
for size in [16, 32, 48] {
    var dib = Data()
    for value in [40, size, size*2] { dib.append(le32(value)) }
    dib.append(le16(1)); dib.append(le16(32))
    for value in [0, size*size*4, 0, 0, 0, 0] { dib.append(le32(value)) }
    for y in (0..<size).reversed() {
        for x in 0..<size {
            let c = reps[size]!.colorAt(x: x, y: y)!.usingColorSpace(.sRGB)!
            dib.append(contentsOf: [c.blueComponent, c.greenComponent, c.redComponent].map { UInt8(max(0, min(255, ($0*255).rounded()))) } + [255])
        }
    }
    dib.append(Data(repeating: 0, count: ((size+31)/32)*4*size))
    payloads.append(dib)
}
var ico = Data([0, 0, 1, 0, 3, 0])
var offset = 6 + 16*3
for (i, size) in [16, 32, 48].enumerated() {
    ico.append(contentsOf: [UInt8(size), UInt8(size), 0, 0])
    ico.append(le16(1)); ico.append(le16(32)); ico.append(le32(payloads[i].count)); ico.append(le32(offset))
    offset += payloads[i].count
}
for p in payloads { ico.append(p) }
try ico.write(to: root.appendingPathComponent("export/favicon.ico"))

// Local presentation only: native pixels, plus simulated tabs and mask crops.
let width = 1480, height = 1120
let board = canvas(width, height) {
    func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect { NSRect(x: x, y: CGFloat(height)-y-h, width: w, height: h) }
    func fill(_ c: NSColor, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) { c.setFill(); rect(x,y,w,h).fill() }
    func label(_ s: String, _ x: CGFloat, _ y: CGFloat, _ c: NSColor, _ size: CGFloat = 16) {
        (s as NSString).draw(in: rect(x,y,700,30), withAttributes: [.font: NSFont.systemFont(ofSize: size), .foregroundColor: c])
    }
    func icon(_ size: Int, _ x: CGFloat, _ y: CGFloat) {
        asImage(reps[size]!).draw(in: rect(x,y,CGFloat(size),CGFloat(size)))
    }
    fill(rgb(0xdee5df),0,0,CGFloat(width),CGFloat(height))
    label("MOONVEIL / generated camping icon",32,20,rgb(0x172f34),24)
    label("Native pixel sizes • local AppKit sheet • simulated tabs, no browser render",32,55,rgb(0x31494b))
    for column in 0..<2 {
        let x = CGFloat(24 + column*732)
        let bg = column == 0 ? rgb(0xf6f5ef) : rgb(0x111d25)
        let fg = column == 0 ? rgb(0x203a3c) : rgb(0xe6e9df)
        fill(bg,x,100,700,990)
        label(column == 0 ? "LIGHT SURROUND" : "DARK SURROUND",x+24,116,fg)
        fill(column == 0 ? rgb(0xe2e5e2) : rgb(0x2c3940),x+24,160,650,54)
        icon(16,x+40,179)
        label("Moonveil — camp",x+66,176,fg,14)
        label("×",x+234,176,fg,14)
        label("Simulated browser tab / 16 px favicon",x+24,222,fg,13)
        for (size, dx) in [(16,24),(32,100),(48,192),(180,344)] {
            label("\(size) px",x+CGFloat(dx),263,fg,13)
            icon(size,x+CGFloat(dx),296)
        }
        label("512 px / app export (180, 192 and 512 share the same padding)",x+24,493,fg,13)
        icon(512,x+24,530)
        label("Mask crop",x+554,530,fg,13)
        NSGraphicsContext.saveGraphicsState()
        NSBezierPath(ovalIn: rect(x+554,568,112,112)).addClip()
        master.draw(in: rect(x+554,568,112,112))
        NSGraphicsContext.restoreGraphicsState()
        label("16 px × 6",x+554,721,fg,13)
        NSGraphicsContext.current!.imageInterpolation = .none
        asImage(reps[16]!).draw(in: rect(x+554,758,96,96))
        NSGraphicsContext.current!.imageInterpolation = .high
    }
}
try save(board, "preview-sheet.png")
print("Derived PNGs, 16/32/48 DIB ICO, and local preview sheet.")
