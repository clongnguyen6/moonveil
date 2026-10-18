// Node-only drawing checks. Never imported by production costume modules.
import assert from 'node:assert/strict';
import {
  RecordingBrush, inspectCostume, labelAnchorFor, makeContext, RIG,
  type Costume, type CostumeChoice,
} from '../rig.ts';

export function assertSelection(costume: Costume, choice: CostumeChoice) {
  const selected: Costume = {
    ...costume,
    crownY: typeof costume.crownY === 'function' ? costume.crownY(choice) : costume.crownY,
    pieces: Object.fromEntries(Object.entries(costume.pieces).map(([layer, draw]) =>
      [layer, (ctx: Parameters<typeof draw>[0]) => draw({ ...ctx, choice })])),
  };
  const report = inspectCostume(selected);
  const description = `${costume.id} ${JSON.stringify(choice)}`;
  assert.ok(report.insideBox, description);
  assert.ok(report.arcsClear, description);
  assert.ok(report.crownOk, description);
  assert.ok(report.ghostPale, description);
  for (const ghost of [false, true]) for (const [layer, draw] of Object.entries(costume.pieces)) {
    const b = new GeometryProbe();
    draw(makeContext(b, ghost, 1, choice));
    if (!b.rec.ops.length) continue;
    const width = Math.max(0, ...b.shapes.map((s) => s.stroke));
    assert.ok(b.rec.minX - width / 2 >= RIG.box.minX, description);
    assert.ok(b.rec.maxX + width / 2 <= RIG.box.maxX, description);
    assert.ok(b.rec.minY - width / 2 >= RIG.box.minY, description);
    assert.ok(b.rec.maxY + width / 2 <= RIG.box.maxY, description);
    if (layer === 'hoodBack' || layer === 'hatFront') {
      assert.ok(b.rec.maxX + width / 2 <= RIG.arcsBand.minX, description);
      assert.ok(labelAnchorFor(costume, choice) <= b.rec.minY - width / 2 - 6, description);
    }
    if (layer === 'hatFront') {
      for (const [x, y] of [[5, -60], [11, -59]]) {
        for (const [dx, dy] of [[0, 0], [-1.8, 0], [1.8, 0], [0, -1.8], [0, 1.8]]) {
          assert.equal(b.covers(x! + dx!, y! + dy!), false, `${description}: human eye covered`);
        }
      }
    }
    if (layer === 'front') assertHandsClear(b, description);
    if (ghost) for (const c of b.strokeColors) {
      const r = c >> 16 & 255, g = c >> 8 & 255, blue = c & 255;
      assert.ok(blue >= r && blue >= g && r + g + blue >= 360, `${description}: dark ghost stroke`);
    }
  }
}

export function drawnLayers(costume: Costume, choice: CostumeChoice) {
  return Object.entries(costume.pieces).filter(([, draw]) => {
    const b = new RecordingBrush(); draw(makeContext(b, false, 1, choice));
    return b.rec.ops.length > 0;
  }).map(([layer]) => layer);
}

export function assertHandsClear(b: GeometryProbe, description: string) {
  for (const cx of [RIG.armL.x + 4, RIG.armR.x + 4]) {
    for (let dx = -4; dx <= 4; dx += 0.25) for (let dy = -4; dy <= 4; dy += 0.25) {
      if (dx * dx + dy * dy <= 16) {
        assert.equal(b.covers(cx + dx, -22 + dy), false, `${description}: hand covered`);
      }
    }
  }
}

type Point = [number, number];
export class GeometryProbe extends RecordingBrush {
  path: Point[] = [];
  shapes: { points: Point[]; stroke: number }[] = [];
  strokeColors: number[] = [];
  override moveTo(x: number, y: number) { this.path = [[x, y]]; return super.moveTo(x, y); }
  override lineTo(x: number, y: number) { this.path.push([x, y]); return super.lineTo(x, y); }
  override quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    const [sx, sy] = this.path.at(-1)!;
    for (let i = 1; i <= 64; i++) {
      const t = i / 64, u = 1 - t;
      this.path.push([u * u * sx + 2 * u * t * cx + t * t * x, u * u * sy + 2 * u * t * cy + t * t * y]);
    }
    return super.quadraticCurveTo(cx, cy, x, y);
  }
  override closePath() { this.path.push(this.path[0]!); return super.closePath(); }
  override poly(points: readonly number[]) {
    this.path = [];
    for (let i = 0; i < points.length; i += 2) this.path.push([points[i]!, points[i + 1]!]);
    this.path.push(this.path[0]!); return super.poly(points);
  }
  private oval(x: number, y: number, rx: number, ry: number) {
    this.path = Array.from({ length: 129 }, (_, i): Point => {
      const a = i * Math.PI / 64; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
    });
  }
  override circle(x: number, y: number, r: number) { this.oval(x, y, r, r); return super.circle(x, y, r); }
  override ellipse(x: number, y: number, rx: number, ry: number) { this.oval(x, y, rx, ry); return super.ellipse(x, y, rx, ry); }
  override roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.path = [];
    for (const [cx, cy, start] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]) {
      for (let i = 0; i <= 16; i++) {
        const a = start! + i * Math.PI / 32;
        this.path.push([cx! + r * Math.cos(a), cy! + r * Math.sin(a)]);
      }
    }
    this.path.push(this.path[0]!); return super.roundRect(x, y, w, h, r);
  }
  override fill(c: number, alpha?: number) {
    this.shapes.push({ points: [...this.path], stroke: 0 }); return super.fill(c, alpha);
  }
  override stroke(c: number, width = 2, alpha?: number) {
    this.strokeColors.push(c);
    this.shapes.push({ points: [...this.path], stroke: width }); return super.stroke(c, width, alpha);
  }
  covers(x: number, y: number) {
    return this.shapes.some(({ points, stroke }) => {
      let inside = false;
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1]!, [bx, by] = points[i]!;
        if (!stroke) {
          if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
        } else {
          const dx = bx - ax, dy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
          if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= stroke / 2) return true;
        }
      }
      return inside;
    });
  }
}
