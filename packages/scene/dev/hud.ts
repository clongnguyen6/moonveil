// DOM HUD: phase chip, action buttons, preview panel, banner, toast.
export type Scene = 'lobby' | 'seating' | 'night' | 'day' | 'ghost' | 'ended';
export interface Banner { title: string; sub: string }

export interface UiHandlers {
  setScene(s: Scene): void;
  setSpeak(on: boolean): void;
  setAutoSpeak(on: boolean): void;
  setAudio(on: boolean): Promise<void> | void;
  emote(): void;
  setCamera(mode: 'fit' | 'tight'): void;
}

export class Hud {
  readonly root: HTMLElement;
  private chip: HTMLElement; private chipText: HTMLElement; private chipSub: HTMLElement;
  private bannerEl: HTMLElement; private toastEl: HTMLElement;
  private sceneBtns = new Map<string, HTMLButtonElement>();
  private micBtn: HTMLButtonElement; private audioBtn: HTMLButtonElement; private speakBtn: HTMLButtonElement;
  private camBtns = new Map<string, HTMLButtonElement>();
  mic = false;

  constructor(parent: HTMLElement, h: UiHandlers, opts: { panel: boolean; touch: boolean }) {
    this.root = el('div', 'hud'); this.root.id = 'hud'; parent.appendChild(this.root);
    this.chip = el('div', 'chip ui'); this.chip.dataset.ui = '1'; const dot = el('span', 'dot'); this.chipText = el('span', ''); this.chipSub = el('span', 'sub');
    this.chip.append(dot, this.chipText, this.chipSub); this.root.appendChild(this.chip);

    const actions = el('div', 'actions ui'); actions.dataset.ui = '1';
    this.micBtn = btn('🎙 Mic', () => { this.mic = !this.mic; this.micBtn.classList.toggle('on', this.mic); h.setSpeak(this.mic); });
    this.micBtn.classList.add('mic');
    const emoteBtn = btn('👋', () => h.emote());
    actions.append(emoteBtn, this.micBtn); this.root.appendChild(actions);

    const panel = el('div', 'panel ui'); panel.dataset.ui = '1'; const toggle = btn('Preview ▾', () => panel.classList.toggle('open'));
    const menu = el('div', 'menu');
    const g1 = el('div', 'group');
    for (const [label, s] of [['Lobby', 'lobby'], ['Seating', 'seating'], ['Night', 'night'], ['Day', 'day'], ['Ghost', 'ghost'], ['Ended', 'ended']] as const) {
      const b = btn(label, () => { h.setScene(s); this.markScene(s); }); this.sceneBtns.set(s, b); g1.appendChild(b);
    }
    const g3 = el('div', 'group');
    this.speakBtn = btn('Auto speakers', () => { const on = !this.speakBtn.classList.contains('on'); this.speakBtn.classList.toggle('on', on); h.setAutoSpeak(on); }); this.speakBtn.classList.add('on');
    this.audioBtn = btn('Ambience', async () => { const on = !this.audioBtn.classList.contains('on'); this.audioBtn.classList.toggle('on', on); await h.setAudio(on); });
    g3.append(this.speakBtn, this.audioBtn);
    const g4 = el('div', 'group');
    for (const m of ['fit', 'tight'] as const) { const b = btn(m === 'fit' ? 'Cam: fit' : 'Cam: tight', () => { h.setCamera(m); this.markCam(m); }); this.camBtns.set(m, b); g4.appendChild(b); }
    menu.append(title('Scene'), g1, title('Toggles'), g3, title('Phone framing'), g4);
    panel.append(toggle, menu); this.root.appendChild(panel);
    if (!opts.panel) panel.style.display = 'none';
    if (!opts.touch) { const hint = el('div', 'hint'); hint.textContent = 'WASD / arrows to move · hold Space to talk'; this.root.appendChild(hint); }

    this.bannerEl = el('div', 'banner'); this.bannerEl.innerHTML = '<h1></h1><p></p>'; this.root.appendChild(this.bannerEl);
    this.toastEl = el('div', 'toast'); this.root.appendChild(this.toastEl);
  }
  setPhase(text: string, sub: string, night: boolean) { this.chipText.textContent = text; this.chipSub.textContent = sub; this.chip.classList.toggle('night', night); }
  markScene(s: Scene) { for (const [k, b] of this.sceneBtns) b.classList.toggle('on', k === s); }
  markCam(m: string) { for (const [k, b] of this.camBtns) b.classList.toggle('on', k === m); }
  markAudio(on: boolean) { this.audioBtn.classList.toggle('on', on); }
  setMic(on: boolean) { this.mic = on; this.micBtn.classList.toggle('on', on); }
  banner(b: Banner | null) {
    if (b) { this.bannerEl.querySelector('h1')!.textContent = b.title; this.bannerEl.querySelector('p')!.textContent = b.sub; this.bannerEl.classList.add('show'); }
    else this.bannerEl.classList.remove('show');
  }
  toast(text: string, ms = 2500) { this.toastEl.textContent = text; this.toastEl.classList.add('show'); setTimeout(() => this.toastEl.classList.remove('show'), ms); }
}

function el(tag: string, cls: string) { const e = document.createElement(tag); e.className = cls; return e; }
function btn(label: string, onClick: () => void) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.addEventListener('click', onClick); return b; }
function title(t: string) { const e = el('div', 'title'); e.textContent = t; return e; }
