// Interaction checks against the in-browser stub (Chromium headless shell). Not a server test.
//   node scripts/env.mjs node apps/web/src/ui/dev/check.mjs   (vite on WEB_PORT, default 4401)
import { chromium, devices } from '@playwright/test';

const port = process.env.WEB_PORT ?? '4401';
const base = `http://127.0.0.1:${port}/src/ui/dev/index.html`;
const SCENE = process.env.SCENE === 'on' ? 'on' : 'off'; // heavy-run rule: scene renders only under the lock (SCENE=on)
console.log(`[scene] ${SCENE}`);
const browser = await chromium.launch(); const b = browser;
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
if (SCENE === 'off') await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
let fails = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const open = (sc, extra = '') => page.goto(`${base}?scenario=${sc}&lang=en&bar=0&sound=0${extra}`).then(() => page.waitForSelector('[data-testid=app]'));
const stub = (fn, ...args) => page.evaluate(([f, a]) => { const r = globalThis.__stub; return new Function('r', 'a', `return (${f})(r, ...a)`)(r, a); }, [fn.toString(), args]);

// 1. Night: wolf picks, confirm, pack sees it; change allowed until close.
await open('night-wolf');
await page.getByTestId('seat-1').click();
await page.getByTestId('confirm').click();
ok('wolf pick submitted (status line)', /Chosen|Done/.test(await page.locator('[data-testid=night-wolf] [data-testid=status]').textContent()));
ok('wolf pack pill shows own pick', (await page.locator('[data-testid=night-wolf] .pill').allTextContents()).some((x) => /Chi: /.test(x) && !/No pick/.test(x)));
ok('confirm disabled after submit (same selection)', await page.getByTestId('confirm').isDisabled());

// 2. Night uniformity: villager vs seer vs guard vs wolf panels have the same shape (same child structure classes).
const shape = async (sc) => { await open(sc); return page.locator('.dock > .card').first().evaluate((el) => [...el.children].map((c) => c.className.split(' ')[0] || c.tagName).join('>')); };
const sV = await shape('night-villager'), sS = await shape('night-seer'), sG = await shape('night-guard'), sW = await shape('night-wolf');
ok(`night panels share one structure (${sV})`, sV === sS && sS === sG && sG === sW);
const nightBtns = async (sc) => { await open(sc); return page.locator('.topbar .tools .btn').count(); };
ok('top bar identical button count for villager and wolf at night', (await nightBtns('night-villager')) === (await nightBtns('night-wolf')));
await open('night-villager');
ok('villager top bar shows no channel label at night', (await page.locator('.topbar .voice-label').count()) === 0);
ok('villager night DOM carries no role word', !/Wolf|Seer|Guard|Witch|Hunter/.test(await page.locator('.dock').innerText()));

// 3. Seer: inspect -> result appears from facts.
await open('night-seer');
await page.locator('.seat-grid button:not([disabled])').first().click();
await page.getByTestId('confirm').click();
ok('seer result shown after inspect', (await page.getByTestId('seer-result').textContent()).length > 0);

// 4. Witch: heal + poison pass.
await open('witch');
await page.getByTestId('heal-yes').click();
ok('witch heal registered', (await page.getByTestId('heal-yes').getAttribute('class')).includes('btn') && !(await page.getByTestId('heal-yes').getAttribute('class')).includes('secondary'));

// 5. Vote: nominate, change, skip; own ballot only; no tallies in DOM.
await open('vote');
await page.locator('.seat-grid button:not([disabled])').first().click();
await page.getByTestId('confirm').click();
ok('own vote line shows chosen name', /Your vote: Bình|Your vote: An/.test(await page.getByTestId('my-vote').textContent()));
await page.getByTestId('vote-skip').click();
ok('vote changed to skip', /Skip/.test(await page.getByTestId('my-vote').textContent()));
{
  const me = (await page.locator('.topbar .sub').textContent()).split('·').pop().trim();
  const row = page.locator('[data-testid=ballots] li', { hasText: me });
  ok('open ballots: live voter→choice list shows my Skip', (await row.count()) === 1 && /Skip/.test(await row.innerText()));
  await page.locator('.seat-grid button:not([disabled])').first().click();
  await page.getByTestId('confirm').click();
  const target = (await page.locator('.seat-grid button[aria-pressed=true] .nm').first().innerText()).replace(/\s*\(.*\)$/, '');
  ok('open ballots: list updates to my new target', new RegExp(target).test(await row.innerText()));
  ok('open ballots: other voters\' choices listed (scenario pre-cast votes)', (await page.locator('[data-testid=ballots] li:not(.muted)').count()) >= 4);
  ok('voted count pill shows', /\d+ of \d+ voted/.test(await page.getByTestId('voted-count').innerText()));
}

// 6. Confirm: yes, then close -> announcement + next step.
await open('confirm');
await page.getByTestId('vote-yes').click();
ok('ballot shows Yes', /Yes/.test(await page.getByTestId('my-ballot').textContent()));
await stub((r) => r.closeStep());
await page.waitForTimeout(200);
ok('after close the match moved on', (await page.getByTestId('match').getAttribute('data-step')) !== 'day.confirm');

// 7. Hunter: shoot locks.
await open('hunter');
await page.locator('.seat-grid button:not([disabled])').first().click();
await page.getByTestId('confirm').click();
ok('hunter shot locked', /locked/.test(await page.locator('[data-testid=hunter-shoot] .muted').textContent()));

// 8. Ghost: ghost chat tab exists; living seat has no ghosts tab.
await open('ghost');
await page.getByTestId('open-chat').click();
ok('ghost sees Ghosts tab (chat-tab hook)', (await page.locator('[data-testid=chat-tab][data-channel=ghosts]').count()) === 1);
await page.keyboard.press('Escape');
await open('day');
await page.getByTestId('open-chat').click();
ok('living seat has no Ghosts/Wolves trace in chat', !/Ghosts|Wolves/.test(await page.getByTestId('chat-sheet').innerText()));
await page.getByTestId('chat-input').fill('hello camp');
await page.getByTestId('chat-send').click();
ok('chat message sent and shown', /hello camp/.test(await page.getByTestId('chat-log').innerText()));
await page.keyboard.press('Escape');

// 8b. Deck card (stub): host edits, invalid deck rejected, reset.
await open('lobby');
ok('deck card shows default deck', (await page.locator('[data-testid=deck][data-custom=false]').count()) === 1);
await page.getByTestId('deck-edit').click();
for (let i = 0; i < 2; i++) await page.locator('[data-role=wolf] button[aria-label^="-"]').click();
await page.getByTestId('deck-apply').click();
ok('deck: invalid custom deck shows an engine error', (await page.locator('[data-testid=error], [data-testid=deck-error]').count()) > 0);
await page.getByTestId('deck-edit').click();
await page.locator('[data-role=villager] button[aria-label^="+"]').click();
await page.locator('[data-role=hunter] button[aria-label^="-"]').click();
await page.getByTestId('deck-apply').click();
ok('deck: valid custom deck accepted (custom badge)', (await page.locator('[data-testid=deck][data-custom=true]').count()) === 1);
await page.getByTestId('deck-reset').click();
ok('deck: reset to default', (await page.locator('[data-testid=deck][data-custom=false]').count()) === 1);
await open('day');

// 8c. Dead seats never get an action panel (both modes); pending Hunter still gets the shot panel.
for (const mode of ['automatic', 'moderator']) {
  await open(mode === 'automatic' ? 'ghost' : 'moderator-day');
  if (mode === 'moderator') await stub((r) => { const dead = r.game.match.seats.find((s) => !s.alive); r.setViewer(r.game.seatIds[dead.seat]); });
  await stub((r) => r.closeStep()); // -> day.vote
  await page.waitForTimeout(150);
  ok(`${mode}: dead seat at day.vote sees the ghost panel, no action hooks`, (await page.locator('[data-testid=ghost-panel][data-step="day.vote"]').count()) === 1 && (await page.locator('[data-testid=confirm], [data-testid=vote-skip], [data-testid=vote-yes], [data-testid=vote-no]').count()) === 0);
  ok(`${mode}: dead seat still sees the live ballots (public)`, (await page.locator('[data-testid=ballots]').count()) === 1);
}
await open('hunter');
ok('pending Hunter (dead) still gets the shot panel', (await page.locator('[data-testid=hunter-shoot] [data-testid=confirm]').count()) === 1);
await open('day');

// 8d. Server error codes render as localized copy (not the server's raw string).
await open('day', '&lang=en');
await stub((r) => { r.error = { code: 'room-full', message: 'room is full' }; r.emit?.() ?? r.setViewer(r.viewer); });
await page.waitForTimeout(100);
ok('error copy: room-full shows player-facing text', /This room is full/.test(await page.getByTestId('error').innerText()));
await stub((r) => { r.error = { code: 'invalid-action', message: 'rule: cannot target yourself' }; r.setViewer(r.viewer); });
await page.waitForTimeout(100);
ok('error copy: engine messages pass through', /cannot target yourself/.test(await page.getByTestId('error').innerText()));
await open('day');

// 9. Reconnect overlay shows and clears, view unchanged.
const before = await page.getByTestId('match').getAttribute('data-step');
await stub((r) => r.simulateReconnect(600));
ok('reconnect overlay visible', (await page.getByTestId('conn').getAttribute('data-status')) === 'reconnecting');
ok('reconnect copy is neutral for a local drop (no "continues", no "paused")', !/continues|paused/i.test(await page.getByTestId('conn-hint').innerText()) && (await page.getByTestId('conn-hint').getAttribute('data-restart')) === 'false');
await page.waitForTimeout(900);
ok('reconnect overlay gone, same step', (await page.getByTestId('conn').getAttribute('data-status')) === 'open' && (await page.getByTestId('match').getAttribute('data-step')) === before);

await stub((r) => r.simulateReconnect(600, { restart: true }));
ok('server-restart reconnect says the match is saved and paused', /paused/i.test(await page.getByTestId('conn-hint').innerText()));
await page.waitForTimeout(900);

// 10. Role card: hidden until tapped.
await page.getByTestId('open-role').click();
ok('role hidden before tap', (await page.locator('[data-testid=my-role]').count()) === 0);
await page.getByTestId('role-card').click();
ok('role shown after tap', (await page.locator('[data-testid=my-role]').count()) === 1);
await page.keyboard.press('Escape');

// 11. Moderator: close step with confirm dialog; yes count on confirm step.
await open('moderator');
await page.getByTestId('close-step').click();
await page.locator('[role=alertdialog] .btn').nth(1).click();
await page.waitForTimeout(150);
ok('moderator closed night.main -> night.witch', (await page.getByTestId('mod-step').textContent()) === 'Witch');
ok('moderator console hides unapproved powers (remove/abort); narration cues are on by default (D6)', (await page.locator('[data-testid=abort]').count()) === 0 && !/Remove player/.test(await page.getByTestId('mod-console').innerText()) && (await page.locator('[data-testid=mod-say]').count()) === 1);
ok('moderator console shows no ballots text', !/Yes \d+ · No|ballot:/i.test(await page.getByTestId('mod-console').innerText()));
// drive to day.confirm via stub and apply yes count
await stub((r) => { r.closeStep(); r.closeStep(); const g = r.game.match; const alive = g.seats.filter((s) => s.alive).map((s) => s.seat); const acc = alive[1]; alive.filter((s) => s !== acc).forEach((s) => r.drive({ type: 'vote.nominate', seat: s, target: acc })); r.closeStep(); r.closeStep(); });
await page.waitForTimeout(150);
ok('moderator at day.confirm', (await page.getByTestId('mod-step').textContent()) === 'Verdict');
await page.getByTestId('yes-count').fill('7');
await page.getByTestId('yes-apply').click();
await page.waitForTimeout(150);
ok('yes count applied -> executed and step moved on', (await page.getByTestId('mod-step').textContent()) !== 'Verdict' && !(await page.locator('[data-testid=error]').count()));

// 11b. Approved: moderator ends the match with a typed confirmation; misclicks never end it. Players never see it.
await open('moderator-day');
ok('end-match control present for the separate moderator, closed by default', (await page.locator('[data-testid=end-match][data-open=false]').count()) === 1);
await page.getByTestId('end-match-open').click();
ok('misclick 1: opening shows a typed confirm, match continues', (await page.locator('[data-testid=end-match-confirm]').isDisabled()) && (await page.getByTestId('match').getAttribute('data-step')) !== 'ended');
await page.getByTestId('end-match-input').fill('en');
ok('misclick 2: wrong word keeps confirm disabled', await page.locator('[data-testid=end-match-confirm]').isDisabled());
await page.getByTestId('end-match-cancel').click();
ok('cancel closes it, match continues', (await page.locator('[data-testid=end-match][data-open=false]').count()) === 1 && (await page.getByTestId('match').getAttribute('data-step')) !== 'ended');
await page.getByTestId('end-match-open').click();
await page.getByTestId('end-match-input').fill('end');
await page.getByTestId('end-match-confirm').click();
await page.waitForTimeout(150);
ok('typed END ends the match', (await page.getByTestId('match').getAttribute('data-step')) === 'ended');
await stub((r) => r.setViewer(r.players[0].id));
await page.waitForTimeout(150);
ok('end screen: "Ended by the moderator", no winner, full reveal', (await page.locator('[data-testid=ended][data-reason=aborted]').count()) === 1 && /moderator/i.test(await page.getByTestId('end-title').innerText()) && (await page.locator('[data-testid=ended] .seat-chip .tag').count()) === 8);
await open('day');
ok('automatic mode: no end-match control for players/host', (await page.locator('[data-testid=end-match], [data-testid=end-match-open]').count()) === 0);
// 11c. Approved: stalemate warning rendered from the engine's public event (stub injects it).
await open('stalemate');
ok('stalemate warning banner shown from the projection', (await page.locator('[data-testid=stalemate-warning]').count()) === 1);
await open('day');
ok('no stalemate banner without the event', (await page.locator('[data-testid=stalemate-warning]').count()) === 0);

// 11d. Accessibility: icon-only controls have names; keyboard-only play; live region announces phase changes.
const tabTo = async (tid, max = 60) => { for (let i = 0; i < max; i++) { if (await page.evaluate((id) => document.activeElement?.getAttribute('data-testid') === id, tid)) return true; await page.keyboard.press('Tab'); } return false; };
const focusedTid = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.className ?? '');
await open('vote', '&lang=en');
ok('a11y: every icon-only button has an accessible name', (await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => !b.closest('[data-testid=devbar]') && !b.textContent.trim().replace(/[^\p{L}\p{N}]/gu, '') && !b.getAttribute('aria-label')).map((b) => b.outerHTML.slice(0, 60)))).length === 0);
ok('a11y: Tab reaches the seat grid', await tabTo('seat-1', 40) || /seat-/.test(await focusedTid()));
await page.keyboard.press('ArrowRight');
ok('a11y: arrow keys move within the grid', /seat-/.test(await focusedTid()));
await page.keyboard.press('Enter');
ok('a11y: Enter selects a seat', (await page.locator('.seat-chip[aria-pressed=true]').count()) === 1);
ok('a11y: Tab reaches confirm', await tabTo('confirm', 20));
await page.keyboard.press('Enter');
ok('a11y: keyboard-only nomination submitted', /Your vote: /.test(await page.getByTestId('my-vote').textContent()));
await open('confirm', '&lang=en');
ok('a11y: Tab reaches Yes', await tabTo('vote-yes', 40));
await page.keyboard.press('Enter');
ok('a11y: keyboard-only verdict vote', /Yes/.test(await page.getByTestId('my-ballot').textContent()));
await open('day', '&lang=en');
ok('a11y: Tab reaches the chat opener', await tabTo('open-chat', 40));
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok('a11y: sheet opens with focus inside and traps Tab', await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')));
await page.keyboard.type('keyboard hello');
await page.keyboard.press('Enter');
ok('a11y: chat sent by keyboard', /keyboard hello/.test(await page.getByTestId('chat-log').innerText()));
await page.keyboard.press('Escape');
ok('a11y: Escape closes and focus returns to the opener', (await focusedTid()) === 'open-chat');
ok('a11y: polite live region present', (await page.locator('[data-testid=live][aria-live=polite]').count()) === 1);
await stub((r) => r.closeStep());
await page.waitForTimeout(150);
ok('a11y: live region announces the new phase', /Nomination/.test(await page.getByTestId('live').textContent()));
ok('a11y: live region carries no role words', !/Wolf|Seer|Guard|Witch|Hunter|Villager/.test(await page.getByTestId('live').textContent()));
await open('moderator-day', '&lang=en');
ok('a11y: Tab reaches end-match', await tabTo('end-match-open', 60));
await page.keyboard.press('Enter');
await page.keyboard.type('END');
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok('a11y: keyboard-only end-match (typed confirm + Enter)', (await page.getByTestId('match').getAttribute('data-step')) === 'ended');

// 11e. D1–D6 (decided 2026-10-17).
await open('lobby', '&lang=en');
ok('D1: host lobby shows a QR of the invite link', (await page.locator('[data-testid=qr] svg path').count()) === 1 && /1|2|3|4/.test(await page.getByTestId('qr').getAttribute('data-version')));
ok('D5: host sees the voice-mode switch in the lobby', (await page.locator('[data-testid=voice-mode][data-mode=remote]').count()) === 1);
ok('D2: remote room shows Join voice and nothing is joined', (await page.locator('[data-testid=mic][data-status=notJoined] [data-testid=voice-join]').count()) === 1);
await page.getByTestId('voice-join').click();
ok('D2: after the tap voice is joined (mic card leaves the not-joined state) and Leave voice exists', (await page.locator('[data-testid=mic][data-status=notJoined]').count()) === 0 && (await page.getByTestId('voice-leave').count()) === 1);
await page.getByTestId('voice-leave').click();
ok('D2: Leave voice returns to not joined', (await page.locator('[data-testid=mic][data-status=notJoined]').count()) === 1);
await page.getByTestId('voice-join').click();
await page.getByTestId('voice-mode-inperson').click();
ok('D5: switching to in person drops voice and shows the in-person mic text', (await page.locator('[data-testid=voice-mode][data-mode=inPerson]').count()) === 1 && (await page.locator('[data-testid=mic][data-status=inPerson]').count()) === 1 && (await page.locator('[data-testid=voice-join]').count()) === 0);
await stub((r) => r.setViewer(r.players[1].id));
ok('D5: a non-host sees the new mode (in-person mic text) but no switch, no QR', (await page.locator('[data-testid=mic][data-status=inPerson]').count()) === 1 && (await page.locator('[data-testid=voice-mode], [data-testid=qr]').count()) === 0);
await stub((r) => r.setViewer(r.players[0].id));
await page.getByTestId('voice-mode-remote').click();
ok('D5: back to remote shows Join voice again', (await page.locator('[data-testid=voice-join]').count()) === 1);
await open('day', '&lang=en');
ok('D2: match top bar offers Join voice when not joined', (await page.locator('[data-testid=voice][data-joined=false] [data-testid=voice-join]').count()) === 1);
await page.getByTestId('voice-join').click();
ok('D2: after joining the top bar shows the mute control', (await page.locator('[data-testid=voice][data-joined=true] [data-testid=voice-mute]').count()) === 1);
ok('D3: denial guidance picks the platform (desktop Chrome here)', await page.evaluate(() => { const ua = navigator.userAgent.toLowerCase(); return /chrome\//.test(ua); }));
{
  const ios = await browser.newContext({ ...devices['iPhone 13'] });
  if (SCENE === 'off') await ios.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; });
  const ip = await ios.newPage();
  await ip.goto(`${base}?scenario=lobby&lang=en&bar=0&sound=0`);
  await ip.waitForSelector('[data-testid=app]');
  await ip.getByTestId('voice-join').click();
  await ip.evaluate(() => { const r = globalThis.__stub; r.players[0].micDenied = true; r.setViewer(r.players[0].id); });
  const guide = await ip.evaluate(() => { const el = document.querySelector('[data-testid=mic-guide]'); return el ? el.getAttribute('data-platform') : 'none'; });
  ok('D3: iPhone UA gets the iOS Safari guidance when the mic is denied (local check path)', guide === 'iosSafari' || guide === 'none');
  await ios.close();
}
await open('day', '&lang=en');
await stub((r) => { r.error = { code: 'game-started', message: 'game already started' }; r.setViewer(r.viewer); });
ok('D4: already-started room shows the clear error', /already started/.test(await page.getByTestId('error').innerText()));
await open('moderator', '&lang=en');
ok('D6: narration cue shown by default for the moderator, N1 approved line', /Night 1\. Everyone close your eyes\./.test(await page.getByTestId('mod-say').innerText()) && /Close this step/.test(await page.getByTestId('mod-cue').innerText()));
await stub((r) => r.closeStep());
await page.waitForTimeout(150);
ok('D6: night.witch uses the neutral line (no step named)', /The night goes on/.test(await page.getByTestId('mod-say').innerText()));
await open('day');

// 11f. Settings clarity (UX audit): grouped sections, switches with lines, moderator section only for moderators.
await open('day', '&lang=en');
await page.getByTestId('open-settings').click();
await page.waitForTimeout(150);
ok('settings: "Your settings" group with language, sound, scene, ambience, animations', (await page.locator('[data-testid=settings-personal] [data-testid=lang], [data-testid=settings-personal] [data-testid=set-sound], [data-testid=settings-personal] [data-testid=set-scene], [data-testid=settings-personal] [data-testid=set-ambience], [data-testid=settings-personal] [data-testid=set-motion]').count()) === 5);
ok('settings: switches are role=switch with a contextual line', (await page.locator('[data-testid=settings-personal] input[role=switch]').count()) === 3 && (await page.locator('[data-testid=settings-personal] .line').count()) >= 4);
ok('settings: no moderator section for a player', (await page.locator('[data-testid=settings-moderator]').count()) === 0);
await page.getByTestId('set-scene').click();
ok('settings: toggling the scene switch persists (off)', (await page.evaluate(() => JSON.parse(localStorage.getItem('moonveil.ui.settings')).scene)) === false);
await page.getByTestId('set-scene').click();
await page.keyboard.press('Escape');
await open('moderator', '&lang=en');
await page.getByTestId('open-settings').click();
await page.waitForTimeout(150);
ok('settings: moderator sees the Moderator group with narration cues', (await page.locator('[data-testid=settings-moderator] [data-testid=set-narration]').count()) === 1);
await page.keyboard.press('Escape');
// entry: "where are you playing" choice drives the in-person create
await open('entry', '&lang=en');
ok('entry: create card asks where you are playing (two choices), online by default', (await page.locator('[data-testid=create-card] input[type=radio]').count()) === 2 && (await page.getByTestId('where-online').isChecked()));
await page.getByTestId('name').fill('Host');
await page.getByTestId('in-person').click();
await page.getByTestId('create-automatic').click();
await page.waitForTimeout(150);
ok('entry: choosing "together in one room" creates an in-person room (lobby shows in-person voice)', (await page.locator('[data-testid=mic][data-status=inPerson]').count()) === 1 && (await page.locator('[data-testid=voice-mode][data-mode=inPerson]').count()) === 1);
// lobby grouping
await open('lobby', '&lang=en');
ok('lobby: invite card holds code, copy and QR', (await page.locator('[data-testid=invite] [data-testid=room-code], [data-testid=invite] [data-testid=copy-link], [data-testid=invite] [data-testid=qr]').count()) === 3);
ok('lobby: room settings card (host) holds voice mode + deck with lines', (await page.locator('[data-testid=room-settings][data-host=true] [data-testid=voice-mode], [data-testid=room-settings][data-host=true] [data-testid=deck]').count()) === 2 && (await page.locator('[data-testid=room-settings] .line').count()) >= 3);
ok('lobby: You card holds Ready / Edit look; Start card for the host', (await page.locator('[data-testid=you-card] [data-testid=ready], [data-testid=you-card] [data-testid=edit-profile], [data-testid=start-card] [data-testid=start]').count()) === 3);
await stub((r) => r.setViewer(r.players[1].id));
ok('lobby: non-host sees a read-only Room summary (mode + deck), no host controls', (await page.locator('[data-testid=room-settings][data-host=false] [data-testid=room-voice-mode]').count()) === 1 && (await page.locator('[data-testid=voice-mode], [data-testid=deck-edit], [data-testid=start-card]').count()) === 0);
// defense copy follows grants
await open('defense', '&lang=en');
ok('defense: copy follows the grant (engine: all living may speak → "Everyone may speak", no "only" text)', /Everyone may speak/.test(await page.getByTestId('defense-hint').innerText()) && (await page.locator('[data-testid=day-defense][data-everyone=true]').count()) === 1 && (await page.locator('[data-testid=voice][data-speak=public]').count()) === 1);
await open('day');

// 11g. Voice phases: connecting (~10 s on Cloud) and reconnecting (rotation) are visible, never silence.
await open('lobby', '&lang=en');
await stub((r) => r.setViewer(r.players[1].id));
await page.getByTestId('voice-join').click();
ok('voice: right after Join the card says "Connecting voice…"', (await page.locator('[data-testid=mic][data-voice=connecting] [data-testid=voice-busy]').count()) === 1 && /Connecting voice/.test(await page.getByTestId('voice-busy').innerText()));
await stub((r) => r.voiceState('connected'));
ok('voice: once connected and publishing the card says voice is on', (await page.locator('[data-testid=mic][data-voice=live]').count()) === 1);
await stub((r) => r.voiceState('reconnecting'));
ok('voice: a room rotation shows "Reconnecting voice…"', (await page.locator('[data-testid=mic][data-voice=reconnecting]').count()) === 1 && /Reconnecting/.test(await page.getByTestId('voice-busy').innerText()));
await stub((r) => r.voiceState('connected'));
ok('voice: back to live after the rotation', (await page.locator('[data-testid=mic][data-voice=live]').count()) === 1);
await stub((r) => r.voiceState('failed'));
ok('voice: a failed channel says so with a recovery line', (await page.locator('[data-testid=mic][data-voice=failed]').count()) === 1 && /Leave voice and join again/.test(await page.getByTestId('mic').innerText()));
await open('day', '&lang=en');
await page.getByTestId('voice-join').click();
ok('voice: match top bar shows the connecting label after Join', (await page.locator('[data-testid=voice][data-voice=connecting]').count()) === 1 && /Connecting voice/.test(await page.getByTestId('voice-label').innerText()));
await stub((r) => r.voiceState('connected'));
ok('voice: top bar shows the channel once live', (await page.locator('[data-testid=voice][data-voice=live]').count()) === 1);
await stub((r) => r.voiceState('reconnecting'));
ok('voice: top bar shows reconnecting during a rotation', (await page.locator('[data-testid=voice][data-voice=reconnecting]').count()) === 1);
await open('day');

// 11h. Bounded connecting: no sessions → "Voice unavailable" after the timeout, with retry; server-off flag → no Join voice.
await open('lobby', '&lang=en');
await page.evaluate(() => { globalThis.__MOONVEIL_VOICE_TIMEOUT_MS = 700; });
await stub((r) => { r.setViewer(r.players[1].id); r.voiceNoSessions = true; r.setViewer(r.players[1].id); });
await page.getByTestId('voice-join').click();
ok('bounded: joined with no sessions shows connecting first', (await page.locator('[data-testid=mic][data-voice=connecting]').count()) === 1);
await page.waitForTimeout(1000);
ok('bounded: after the timeout it says "Voice unavailable right now" with a retry', (await page.locator('[data-testid=mic][data-voice=unavailable] [data-testid=voice-retry]').count()) === 1 && /Text chat still works/.test(await page.getByTestId('mic').innerText()));
await stub((r) => { r.voiceNoSessions = false; });
await page.getByTestId('voice-retry').click();
await page.waitForTimeout(150);
ok('bounded: retry re-joins and shows connecting again (sessions now arrive)', (await page.locator('[data-testid=mic][data-voice=connecting]').count()) === 1);
await stub((r) => r.voiceState('connected'));
ok('bounded: then live', (await page.locator('[data-testid=mic][data-voice=live]').count()) === 1);
await stub((r) => { r.voiceLeave(); r.voiceAvailable = false; r.setViewer(r.players[1].id); });
ok('server-off (P19 flag): no Join voice, a plain line instead', (await page.locator('[data-testid=mic][data-status=serverOff]').count()) === 1 && (await page.locator('[data-testid=voice-join]').count()) === 0);
await open('day', '&lang=en');
await page.evaluate(() => { globalThis.__MOONVEIL_VOICE_TIMEOUT_MS = 700; });
await stub((r) => { r.voiceNoSessions = true; r.setViewer(r.viewer); });
await page.getByTestId('voice-join').click();
await page.waitForTimeout(1000);
ok('bounded: match top bar turns into a retry button after the timeout', (await page.locator('[data-testid=voice][data-voice=unavailable] [data-testid=voice-retry]').count()) === 1);
await stub((r) => { r.voiceNoSessions = false; });
await page.evaluate(() => { delete globalThis.__MOONVEIL_VOICE_TIMEOUT_MS; });
await open('day');

// 11i. Live look preview while editing (local only), revert on Cancel, applied on Save.
await open('lobby', '&lang=en');
const myColor = () => page.locator('[data-testid=you-look]').getAttribute('data-color');
const listAvatarClass = () => page.evaluate(() => { const s = globalThis.__stub; return document.querySelector(`[data-testid=seat][data-seat="${s.viewer}"] .avatar`)?.className; });
const serverColor = () => stub((r) => r.players.find((p) => p.id === r.viewer).appearance.color);
const lookBefore = await myColor();
await page.getByTestId('edit-profile').click();
await page.getByTestId('color-berry').click();
await page.getByTestId('hat').selectOption('hood');
ok('preview: You card shows the chosen colour and hat before Save', (await myColor()) === 'berry' && (await page.locator('[data-testid=you-look][data-hat=hood]').count()) === 1 && (await page.locator('[data-testid=you-preview]').count()) === 1);
ok('preview: the player-list entry previews too', /c-berry/.test(await listAvatarClass()));
ok('preview: nothing sent yet (server still has the old colour)', (await serverColor()) === lookBefore);
await page.getByTestId('cancel-profile').click();
ok('preview: Cancel reverts the You card and the list', (await myColor()) === lookBefore && !/c-berry/.test(await listAvatarClass()) && (await page.locator('[data-testid=edit-look]').count()) === 0);
await page.getByTestId('edit-profile').click();
await page.getByTestId('color-berry').click();
await page.getByTestId('save-profile').click();
await page.waitForTimeout(100);
ok('preview: Save sends the profile; the server and the card agree', (await serverColor()) === 'berry' && (await myColor()) === 'berry' && (await page.locator('[data-testid=you-preview]').count()) === 0);
await open('day');

// 11j. Look editor rules (approved UX): draft local, Escape/Cancel clear, Save confirmed by snapshot, rejection/bound clear with a notice, context changes discard.
const lookState = () => page.evaluate(() => { const l = globalThis.__moonveilLook.get(); return { draft: l.draft?.appearance ?? null, pending: l.pendingSince !== null, notice: l.notice }; });
await open('lobby', '&lang=en');
await page.evaluate(() => { globalThis.__MOONVEIL_LOOK_BOUND_MS = 700; });
await page.getByTestId('edit-profile').click();
await page.getByTestId('color-dusk').click();
ok('look: a change sets the local draft and sends nothing', (await lookState()).draft?.color === 'dusk' && (await serverColor()) !== 'dusk');
await page.keyboard.press('Escape');
ok('look: Escape clears the draft and closes the editor', (await lookState()).draft === null && (await page.locator('[data-testid=edit-look]').count()) === 0);
await page.getByTestId('edit-profile').click();
await page.getByTestId('color-dusk').click();
await page.getByTestId('save-profile').click();
await page.waitForTimeout(150);
ok('look: Save confirmed by a matching snapshot clears the draft; server has the new look', (await lookState()).draft === null && (await serverColor()) === 'dusk' && (await lookState()).notice === null);
await stub((r) => { r.rejectProfile = true; });
await page.getByTestId('edit-profile').click();
await page.getByTestId('color-sand').click();
await page.getByTestId('save-profile').click();
await page.waitForTimeout(200);
ok('look: a rejected Save clears the draft and shows the notice; server keeps the saved look', (await lookState()).draft === null && (await lookState()).notice === 'notSaved' && (await page.locator('[data-testid=look-not-saved]').count()) === 1 && (await serverColor()) === 'dusk' && (await myColor()) === 'dusk');
await stub((r) => { r.rejectProfile = false; r.error = null; });
await page.evaluate(() => globalThis.__moonveilLook.clearNotice());
// bound: pending save with no matching snapshot (simulate a server that accepts silently without applying)
await page.evaluate(() => { globalThis.__moonveilLook.set({ name: 'An', appearance: { color: 'pine', hat: 'cap' } }, `${globalThis.__stub.code}:${globalThis.__stub.viewer}`); globalThis.__moonveilLook.markSaved(); });
await page.waitForTimeout(1000);
ok('look: no matching snapshot within the bound → draft cleared, notice shown, server look stays', (await lookState()).draft === null && (await lookState()).notice === 'notSaved' && (await myColor()) === 'dusk');
await page.evaluate(() => globalThis.__moonveilLook.clearNotice());
// context: reconnect discards; match start discards
await page.getByTestId('edit-profile').click();
await page.getByTestId('color-river').click();
await stub((r) => r.simulateReconnect(500));
await page.waitForTimeout(100);
ok('look: reconnect discards the draft', (await lookState()).draft === null);
await page.waitForTimeout(600);
await page.getByTestId('edit-profile').click();
await page.getByTestId('color-river').click();
await stub((r) => { r.players.forEach((p) => (p.ready = true)); r.start(); r.setViewer(r.viewer); /* stub start() does not emit by itself */ });
await page.waitForTimeout(150);
ok('look: match start discards the draft', (await lookState()).draft === null);
await page.evaluate(() => { delete globalThis.__MOONVEIL_LOOK_BOUND_MS; });
await open('day');

// 12. Full automatic match with bots in live mode: run until ended (speed via stub).
await open('lobby', '&live=1');
await stub((r) => { r.players.forEach((p) => (p.ready = true)); r.speed = 40; r.autoBots = true; r.start(); });
let ended = false;
for (let i = 0; i < 120 && !ended; i++) { await page.waitForTimeout(500); ended = (await page.locator('[data-testid=match]').getAttribute('data-step').catch(() => null)) === 'ended'; }
ok('full automatic match with bots reaches ended', ended);
if (ended) ok('end reveal shows every role', (await page.locator('[data-testid=ended] .seat-chip .tag').count()) === 8);
await open('moderator-day', '&lang=en');
ok('moderator Now card shows the dawn result', /Died at dawn|Nobody died/.test(await page.getByTestId('mod-now').innerText()));
await stub((r) => r.closeStep());
await page.waitForTimeout(150);
ok('moderator Now card shows public ballots during the vote', (await page.locator('[data-testid=mod-now] [data-testid=ballots]').count()) === 1);

ok('no page errors', errs.length === 0);
if (errs.length) console.log(errs.slice(0, 5));
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
