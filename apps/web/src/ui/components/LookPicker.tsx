// Look picker: outfit first, then that outfit's options. Every list comes from the catalog (OUTFITS via game/look.ts);
// a control shows only when the outfit offers more than one choice. Names: i18n `lookNames`, else the humanized id,
// so a future catalog entry appears with no change here. Hooks kept for the harness: `color-<id>`, `hat` (select).
import type { OutfitId } from '@moonveil/protocol';
import { choices, humanize, type Look, outfitIds, withOutfit } from '../../game/look.ts';
import { useT } from '../i18n/index.ts';

export function LookPicker({ value, onChange }: { value: Look; onChange: (next: Look) => void }) {
  const t = useT();
  const name = (key: string, id: string) => t.s.lookNames[key] ?? humanize(id);
  const c = choices(value.outfit);
  const set = (patch: Partial<Look>) => onChange({ ...value, ...patch });
  const select = (field: 'hat' | 'front' | 'back', label: string, ids: readonly string[], kind: 'hat' | 'acc') =>
    ids.length > 0 && (
      <label className="field col look-field" style={{ gap: 4 }}>
        {label}
        <select className="input" data-testid={field} value={value[field]} onChange={(e) => set({ [field]: e.target.value } as Partial<Look>)}>
          {ids.map((id) => <option key={id} value={id}>{name(`${kind}.${id}`, id)}</option>)}
        </select>
      </label>
    );
  return (
    <div className="look-picker col" data-testid="look-picker" data-outfit={value.outfit} data-variant={value.variant}>
      <div className="field">
        <span id="look-outfit">{t('lookOutfit')}</span>
        <div className="chips" role="radiogroup" aria-labelledby="look-outfit">
          {outfitIds().map((o) => (
            <button key={o} type="button" className="chip" role="radio" aria-checked={value.outfit === o} data-testid={`outfit-${o}`} onClick={() => value.outfit !== o && onChange(withOutfit(value, o as OutfitId))}>
              {name(`outfit.${o}`, o)}
            </button>
          ))}
        </div>
      </div>
      {c.variants.length > 0 && (
        <div className="field">
          <span id="look-style">{t('lookStyle')}</span>
          <div className="chips" role="radiogroup" aria-labelledby="look-style">
            {c.variants.map((v) => (
              <button key={v} type="button" className="chip" role="radio" aria-checked={value.variant === v} data-testid={`variant-${v}`} onClick={() => set({ variant: v })}>
                {name(`variant.${value.outfit}.${v}`, v)}
              </button>
            ))}
          </div>
        </div>
      )}
      {c.colors.length > 0 && (
        <div className="field">
          <span id="look-colour">{t('entryColour')}</span>
          <div className="swatches" role="radiogroup" aria-labelledby="look-colour">
            {c.colors.map((col) => (
              <button key={col} type="button" className={`swatch c-${col}`} role="radio" aria-checked={value.color === col} aria-label={name(`color.${col}`, col)} data-testid={`color-${col}`} onClick={() => set({ color: col as Look['color'] })} />
            ))}
          </div>
        </div>
      )}
      <div className="look-selects">
        {select('hat', t('lookHeadgear'), c.hats, 'hat')}
        {select('front', t('lookFront'), c.fronts, 'acc')}
        {select('back', t('lookBack'), c.backs, 'acc')}
      </div>
    </div>
  );
}
