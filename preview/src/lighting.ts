// Lightmap: ambient colour + additive light blobs rendered to a quarter-resolution texture,
// then multiplied over the scene. Cheap on mobile (no full-screen shader filters).
import { Container, Graphics, RenderTexture, Renderer, Sprite, Texture } from 'pixi.js';
import { WORLD } from './world';

export class Lighting {
  readonly lights = new Container();
  readonly out: Sprite;
  private rt: RenderTexture;
  private ambientRect: Graphics;
  ambient = 0xffffff;

  constructor(private renderer: Renderer, private lightTex: Texture) {
    this.ambientRect = new Graphics().rect(-2000, -2000, WORLD.w + 4000, WORLD.h + 4000).fill(0xffffff);
    this.lights.addChild(this.ambientRect);
    this.rt = RenderTexture.create({ width: 64, height: 64, resolution: 0.25 });
    this.out = new Sprite(this.rt);
    this.out.blendMode = 'multiply';
  }

  addLight(color: number, scale: number, alpha = 1): Sprite {
    const s = new Sprite(this.lightTex);
    s.anchor.set(0.5); s.blendMode = 'add'; s.tint = color; s.scale.set(scale); s.alpha = alpha;
    this.lights.addChild(s);
    return s;
  }

  resize(w: number, h: number) {
    this.rt.resize(w, h, 0.25);
    this.out.width = w; this.out.height = h;
  }

  render(camera: { x: number; y: number; scale: number }) {
    this.ambientRect.tint = this.ambient;
    this.lights.position.set(camera.x, camera.y);
    this.lights.scale.set(camera.scale);
    this.renderer.render({ container: this.lights, target: this.rt, clear: true, clearColor: this.ambient });
  }
}
