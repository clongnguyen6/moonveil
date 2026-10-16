// Keyboard (laptop) + floating virtual joystick (touch). Produces a unit direction vector.
export class Input {
  dir = { x: 0, y: 0 };
  readonly touch: boolean;
  private keys = new Set<string>();
  private joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private base: HTMLElement; private knob: HTMLElement;
  onSpeakKey: ((down: boolean) => void) | null = null;

  constructor(surface: HTMLElement, hud: HTMLElement) {
    this.touch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    window.addEventListener('keydown', (e) => { if (e.repeat) return; this.keys.add(e.code); if (e.code === 'Space') { this.onSpeakKey?.(true); e.preventDefault(); } });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Space') this.onSpeakKey?.(false); });
    window.addEventListener('blur', () => this.keys.clear());

    this.base = document.createElement('div'); this.base.className = 'joy-base';
    this.knob = document.createElement('div'); this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob); hud.appendChild(this.base);
    this.base.classList.toggle('show', this.touch);
    this.restJoystick();

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !this.touch) return;
      if ((e.target as HTMLElement).closest('.ui')) return;
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
      if (e.pointerId !== this.joy.id) return;
      this.joy.active = false; this.joy.x = this.joy.y = 0; this.restJoystick();
    };
    surface.addEventListener('pointerdown', down);
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
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
    if (this.joy.active) { x = this.joy.x; y = this.joy.y; }
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    if (d < 0.12) { x = 0; y = 0; }
    this.dir.x = x; this.dir.y = y;
  }
}
