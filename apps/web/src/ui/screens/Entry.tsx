// Join / create. Profile is public (name + look); it never relates to a role.
import { AppearanceInput, type Mode, NAME_MAX, normalizeCostume, normalizeName } from '@moonveil/protocol';
import { useState } from 'react';
import { type Look, resolveLook } from '../../game/look.ts';
import type { SessionState } from '../../game/session.ts';
import { Button } from '../components/index.tsx';
import { LookPicker } from '../components/LookPicker.tsx';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';
import { errorText, screenError } from '../errors.ts';
import { SettingsRow } from './Settings.tsx';

// Stored as entered: legacy {color, hat} from older versions stays legacy until the player changes it, so the server
// keeps its seat-seeded camper extras; any picker change stores the canonical costume form.
export interface StoredProfile { name: string; appearance: AppearanceInput }
const PROFILE_KEY = 'moonveil.profile';
const DEFAULT_LOOK = (normalizeCostume({ outfit: 'camper' }) as { ok: true; value: Look }).value;
export function loadProfile(): StoredProfile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as StoredProfile | null;
    if (p && typeof p.name === 'string' && AppearanceInput.safeParse(p.appearance).success && resolveLook(p.appearance, 'entry').ok) return p;
  } catch {}
  return { name: '', appearance: DEFAULT_LOOK };
}
export function saveProfile(p: StoredProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}
/** The look the entry picker shows: legacy → camper without seat extras (no seat yet); costume → canonical. */
function entryLook(a: AppearanceInput): Look {
  const r = 'outfit' in a ? normalizeCostume(a) : normalizeCostume({ outfit: 'camper', color: a.color, hat: a.hat });
  return r.ok ? r.value : DEFAULT_LOOK;
}

export function roomFromPath(): string | null {
  return /^\/r\/([A-Za-z0-9]{6})\/?$/.exec(location.pathname)?.[1]?.toUpperCase() ?? null;
}

export function ProfileEditor({ value, onChange }: { value: StoredProfile; onChange: (p: StoredProfile) => void }) {
  const t = useT();
  return (
    <div className="col">
      <label className="field col" style={{ gap: 4 }}>
        {t('entryName')}
        <input className="input" data-testid="name" value={value.name} maxLength={NAME_MAX} autoComplete="nickname" placeholder={t('entryNamePh')} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        <span className="muted" style={{ fontSize: 'var(--fs-0)' }}>{t('entryNameHint')}</span>
      </label>
      <LookPicker value={entryLook(value.appearance)} onChange={(appearance) => onChange({ ...value, appearance })} />
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
  const go = (fn: (p: StoredProfile) => void) => {
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
      {screenError(s) && <p className="danger" role="alert" data-testid="error" data-code={screenError(s)!.code}>{errorText(t, screenError(s))}</p>}
      <section className="card stack" style={{ padding: 16 }}>
        {!linkCode && <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('entryJoinTitle')}</h2>}
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
        <section className="card stack" style={{ padding: 16 }} data-testid="create-card">
          <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('entryNewRoom')}</h2>
          <div className="field">
            <span>{t('entryWhere')}</span>
            <div className="choice" role="radiogroup" aria-label={t('entryWhere')}>
              <label data-checked={!inPerson}>
                <input type="radio" name="where" checked={!inPerson} onChange={() => setInPerson(false)} data-testid="where-online" />
                <span className="meta"><span className="lbl">{t('entryOnline')}</span><span className="line">{t('entryOnlineLine')}</span></span>
              </label>
              <label data-checked={inPerson}>
                <input type="radio" name="where" checked={inPerson} onChange={() => setInPerson(true)} data-testid="in-person" />
                <span className="meta"><span className="lbl">{t('entryTogether')}</span><span className="line">{t('entryTogetherLine')}</span></span>
              </label>
            </div>
          </div>
          <Button wide testId="create-automatic" disabled={!valid || busy} onClick={() => create('automatic')}>{t('entryCreateAuto')}</Button>
          <p className="line center">{t('entryCreateAutoHint')}</p>
          <Button wide kind="secondary" testId="create-moderator" disabled={!valid || busy} onClick={() => create('moderator')}>{t('entryCreateMod')}</Button>
          <p className="line center">{t('entryCreateModHint')}</p>
        </section>
      )}
      <SettingsRow />
    </main>
  );
}
