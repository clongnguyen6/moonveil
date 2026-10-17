// Personal settings (this device only) and, for the moderator, the moderator aids. Plain outcome-oriented labels with
// a short line each; on/off as switches; grouped and separated from room/host controls (those live in the lobby).
import { type Lang, type Settings, settingsStore, useSettings } from '../../game/local-store.ts';
import { useT } from '../i18n/index.ts';

function Toggle({ id, label, line, checked, onChange }: { id: string; label: string; line?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting row" htmlFor={id}>
      <span className="meta">
        <span className="lbl">{label}</span>
        {line && <span className="line">{line}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} aria-checked={checked} data-testid={id} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsPanel({ moderator = false, compact = false }: { moderator?: boolean; compact?: boolean }) {
  const t = useT();
  const s = useSettings();
  const set = (patch: Partial<Settings>) => settingsStore.set(patch);
  return (
    <div className="settings" data-testid="settings">
      <section className="setting-group" data-testid="settings-personal">
        <h3 className="group-title">{t('setYours')}</h3>
        <p className="line">{t('setYoursLine')}</p>
        <label className="setting row" htmlFor="set-lang">
          <span className="meta"><span className="lbl">{t('language')}</span></span>
          <select id="set-lang" className="input" style={{ width: 'auto' }} value={s.lang} onChange={(e) => set({ lang: e.target.value as Lang })} data-testid="lang">
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <Toggle id="set-sound" label={t('setSound')} line={t('setSoundLine')} checked={s.sound} onChange={(v) => set({ sound: v })} />
        {!compact && (
          <>
            <Toggle id="set-scene" label={t('setScene')} line={t('setSceneLine')} checked={s.scene} onChange={(v) => set({ scene: v })} />
            <Toggle id="set-ambience" label={t('setAmbience')} line={t('setAmbienceLine')} checked={s.ambience} onChange={(v) => set({ ambience: v })} />
            <label className="setting row" htmlFor="set-motion">
              <span className="meta"><span className="lbl">{t('setMotion')}</span><span className="line">{t('setMotionLine')}</span></span>
              <select id="set-motion" className="input" style={{ width: 'auto' }} value={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.value as Settings['reducedMotion'] })} data-testid="set-motion">
                <option value="system">{t('motionSystem')}</option>
                <option value="on">{t('motionReduce')}</option>
                <option value="off">{t('motionFull')}</option>
              </select>
            </label>
          </>
        )}
      </section>
      {moderator && (
        <section className="setting-group" data-testid="settings-moderator">
          <h3 className="group-title">{t('setModerator')}</h3>
          <Toggle id="set-narration" label={t('setNarration')} line={t('setNarrationLine')} checked={s.modNarration} onChange={(v) => set({ modNarration: v })} />
        </section>
      )}
    </div>
  );
}

/** Entry screen: just the language (the rest lives in Settings once you're in a room). */
export function SettingsRow() {
  const t = useT();
  const s = useSettings();
  return (
    <div className="row" style={{ justifyContent: 'center' }} data-testid="settings">
      <label className="field row" htmlFor="entry-lang">
        {t('language')}
        <select id="entry-lang" className="input" style={{ width: 'auto' }} value={s.lang} onChange={(e) => settingsStore.set({ lang: e.target.value as Lang })} data-testid="lang">
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
  );
}
