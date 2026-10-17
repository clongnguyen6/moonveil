// Join / create. Profile is public (name + look); it never relates to a role.
import { APPEARANCE_COLORS, APPEARANCE_HATS, type Appearance, type Mode, NAME_MAX, type Profile, normalizeName } from '@moonveil/protocol';
import { useState } from 'react';
import type { SessionState } from '../../game/session.ts';
import { Button } from '../components/index.tsx';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';
import { errorText } from '../errors.ts';
import { SettingsRow } from './Settings.tsx';

const PROFILE_KEY = 'moonveil.profile';
export function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as Profile | null;
    if (p && APPEARANCE_COLORS.includes(p.appearance.color) && APPEARANCE_HATS.includes(p.appearance.hat)) return p;
  } catch {}
  return { name: '', appearance: { color: APPEARANCE_COLORS[0], hat: 'none' } };
}
export function saveProfile(p: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function roomFromPath(): string | null {
  return /^\/r\/([A-Za-z0-9]{6})\/?$/.exec(location.pathname)?.[1]?.toUpperCase() ?? null;
}

export function ProfileEditor({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  const t = useT();
  const setA = (a: Partial<Appearance>) => onChange({ ...value, appearance: { ...value.appearance, ...a } });
  return (
    <div className="col">
      <label className="field col" style={{ gap: 4 }}>
        {t('entryName')}
        <input className="input" data-testid="name" value={value.name} maxLength={NAME_MAX} autoComplete="nickname" placeholder={t('entryNamePh')} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        <span className="muted" style={{ fontSize: 'var(--fs-0)' }}>{t('entryNameHint')}</span>
      </label>
      <div className="field">
        <span>{t('entryColour')}</span>
        <div className="swatches" role="radiogroup" aria-label={t('entryColour')}>
          {APPEARANCE_COLORS.map((c) => (
            <button key={c} type="button" className={`swatch c-${c}`} role="radio" aria-checked={value.appearance.color === c} aria-pressed={value.appearance.color === c} aria-label={c} data-testid={`color-${c}`} onClick={() => setA({ color: c })} />
          ))}
        </div>
      </div>
      <label className="field col" style={{ gap: 4 }}>
        {t('entryHat')}
        <select className="input" data-testid="hat" value={value.appearance.hat} onChange={(e) => setA({ hat: e.target.value as Appearance['hat'] })}>
          {APPEARANCE_HATS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function EntryScreen({ s }: { s: SessionState }) {
  const t = useT();
  const session = useSession();
  const linkCode = roomFromPath();
  const [profile, setProfile] = useState(loadProfile);
  const [code, setCode] = useState(linkCode ?? '');
  const busy = s.status === 'connecting' || s.status === 'reconnecting';
  const valid = normalizeName(profile.name).length > 0;
  const go = (fn: (p: Profile) => void) => {
    const p = { ...profile, name: normalizeName(profile.name) };
    saveProfile(p);
    fn(p);
  };
  const [inPerson, setInPerson] = useState(false);
  const create = (m: Mode) => go((p) => session.create(m, p, inPerson ? 'inPerson' : 'remote'));
  return (
    <main className="entry fade-in" data-testid="entry">
      <div>
        <h1 className="logo">{t('app')}</h1>
        <p className="hint">{t('entryTagline')}</p>
      </div>
      <section className="card stack" style={{ padding: 16 }}>
        <ProfileEditor value={profile} onChange={setProfile} />
      </section>
      {s.error && <p className="danger" role="alert" data-testid="error" data-code={s.error.code}>{errorText(t, s.error)}</p>}
      <section className="card stack" style={{ padding: 16 }}>
        {linkCode ? (
          <p data-testid="invited"><strong>{t('entryInvited', { code: linkCode })}</strong><br /><span className="hint">{t('entryInvitedHint')}</span></p>
        ) : null}
        <label className="field col" style={{ gap: 4, ...(linkCode ? { display: 'none' } : {}) }}>
          {t('entryCode')}
          <input className="input" data-testid="code" value={code} maxLength={6} autoCapitalize="characters" autoComplete="off" inputMode="text" style={{ letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase' }} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </label>
        <Button wide testId="join" disabled={!valid || busy || code.length !== 6} onClick={() => go((p) => session.join(code, p))}>{t('entryJoin')}</Button>
      </section>
      {!linkCode && (
        <section className="card stack" style={{ padding: 16 }}>
          <p className="hint center">{t('entryOr')}</p>
          <label className="field row" style={{ justifyContent: 'center' }}>
            <input type="checkbox" checked={inPerson} onChange={(e) => setInPerson(e.target.checked)} data-testid="in-person" />
            {t('entryInPerson')}
          </label>
          <Button wide kind="secondary" testId="create-automatic" disabled={!valid || busy} onClick={() => create('automatic')}>{t('entryCreateAuto')}</Button>
          <p className="muted center" style={{ fontSize: 'var(--fs-0)' }}>{t('entryCreateAutoHint')}</p>
          <Button wide kind="secondary" testId="create-moderator" disabled={!valid || busy} onClick={() => create('moderator')}>{t('entryCreateMod')}</Button>
          <p className="muted center" style={{ fontSize: 'var(--fs-0)' }}>{t('entryCreateModHint')}</p>
        </section>
      )}
      <SettingsRow />
    </main>
  );
}
