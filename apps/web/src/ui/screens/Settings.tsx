import { type Lang, settingsStore, useSettings } from '../../game/local-store.ts';
import { useT } from '../i18n/index.ts';

export function SettingsRow() {
  const t = useT();
  const s = useSettings();
  return (
    <div className="row wrap" style={{ gap: 12 }} data-testid="settings">
      <label className="field row">
        {t('language')}
        <select className="input" style={{ width: 'auto' }} value={s.lang} onChange={(e) => settingsStore.set({ lang: e.target.value as Lang })} data-testid="lang">
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="field row">
        {t('sound')}
        <select className="input" style={{ width: 'auto' }} value={s.sound ? 'on' : 'off'} onChange={(e) => settingsStore.set({ sound: e.target.value === 'on' })}>
          <option value="on">{t('on')}</option>
          <option value="off">{t('off')}</option>
        </select>
      </label>
      <label className="field row">
        {t('motion')}
        <select className="input" style={{ width: 'auto' }} value={s.reducedMotion} onChange={(e) => settingsStore.set({ reducedMotion: e.target.value as 'system' | 'on' | 'off' })}>
          <option value="system">{t('motionSystem')}</option>
          <option value="on">{t('motionReduce')}</option>
          <option value="off">{t('motionFull')}</option>
        </select>
      </label>
      <label className="field row">
        {t('sceneSetting')}
        <input type="checkbox" checked={s.scene} onChange={(e) => settingsStore.set({ scene: e.target.checked })} />
      </label>
      <label className="field row">
        {t('ambience')}
        <input type="checkbox" checked={s.ambience} onChange={(e) => settingsStore.set({ ambience: e.target.checked })} />
      </label>
      <label className="field row">
        {t('modNarrationSetting')}
        <input type="checkbox" checked={s.modNarration} onChange={(e) => settingsStore.set({ modNarration: e.target.checked })} />
      </label>
    </div>
  );
}
