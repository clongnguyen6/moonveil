// Keyboard (laptop) + floating virtual joystick (touch). Produces a unit direction vector.
import { keysToDir, sceneHandlesKey, SPEAK_KEY, type KeyTargetLike } from './keys.ts';
export class Input {
  dir = { x: 0, y: 0 };
  readonly touch: boolean;
  private keys = new Set<string>();
  private joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private base: HTMLElement; private knob: HTMLElement;
  onSpeakKey: ((down: boolean) => void) | null = null;
  onTap: ((x: number, y: number) => void) | null = null;   // screen px, relative to the surface
  private downAt: { x: number; y: number; t: number } | null = null;
  detach: () => void = () => {};

  constructor(surface: HTMLElement) {
    const hud = surface;
    this.touch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    // Keys typed into chat/inputs or HUD ([data-ui]) are left alone (P14); Escape is never claimed.
    const keydown = (e: KeyboardEvent) => {
      if (e.repeat || !sceneHandlesKey(e.code, e.target as KeyTargetLike | null)) return;
      this.keys.add(e.code);
      if (e.code === SPEAK_KEY) { this.onSpeakKey?.(true); e.preventDefault(); }
    };
    // keyup always releases, so a key pressed in the scene and released inside a text field cannot stick
    const keyup = (e: KeyboardEvent) => { if (this.keys.delete(e.code) && e.code === SPEAK_KEY) this.onSpeakKey?.(false); };
    const blur = () => { if (this.keys.has(SPEAK_KEY)) this.onSpeakKey?.(false); this.keys.clear(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);

    this.base = document.createElement('div'); this.base.className = 'joy-base';
    this.knob = document.createElement('div'); this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob); hud.appendChild(this.base);
    this.base.classList.toggle('show', this.touch);
    this.restJoystick();

    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (e.pointerType === 'mouse' && !this.touch) return;
      this.joy.active = true; this.joy.id = e.pointerId; this.joy.ox = e.clientX; this.joy.oy = e.clientY; this.joy.x = 0; this.joy.y = 0;
      this.base.style.left = `${e.clientX}px`; this.base.style.top = `${e.clientY}px`; this.base.classList.add('active', 'show');
      this.knob.style.transform = 'translate(0px,0px)';
    };
    const move = (e: PointerEvent) => {
      if (!this.joy.active || e.pointerId !== this.joy.id) return;
      const R = 46;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this.joy.x = dx / R; this.joy.y = dy / R;
      this.knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    const up = (e: PointerEvent) => {
      const d = this.downAt; this.downAt = null;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && performance.now() - d.t < 350) {
        const r = surface.getBoundingClientRect();
        this.onTap?.(e.clientX - r.left, e.clientY - r.top);
      }
      if (e.pointerId !== this.joy.id) return;
      this.joy.active = false; this.joy.x = this.joy.y = 0; this.restJoystick();
    };
    surface.addEventListener('pointerdown', down);
    this.detach = () => { surface.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); this.base.remove(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  private restJoystick() {
    this.base.classList.remove('active');
    this.base.style.left = ''; this.base.style.top = '';
    this.knob.style.transform = 'translate(0px,0px)';
  }

  update() {
    let { x, y } = keysToDir(this.keys);
    if (this.joy.active) { x = this.joy.x; y = this.joy.y; }
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    if (d < 0.12) { x = 0; y = 0; }
    this.dir.x = x; this.dir.y = y;
  }
}
