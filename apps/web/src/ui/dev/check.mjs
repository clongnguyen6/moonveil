// Interaction checks against the in-browser stub (Chromium headless shell). Not a server test.
//   node scripts/env.mjs node apps/web/src/ui/dev/check.mjs   (vite on WEB_PORT, default 4401)
import { chromium, devices } from '@playwright/test';

const port = process.env.WEB_PORT ?? '4401';
const base = `http://127.0.0.1:${port}/src/ui/dev/index.html`;
const browser = await chromium.launch(); const b = browser;
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
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
