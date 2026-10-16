// Interaction checks against the in-browser stub (Chromium headless shell). Not a server test.
//   node scripts/env.mjs node apps/web/src/ui/dev/check.mjs   (vite on WEB_PORT, default 4401)
import { chromium } from '@playwright/test';

const port = process.env.WEB_PORT ?? '4401';
const base = `http://127.0.0.1:${port}/src/ui/dev/index.html`;
const b = await chromium.launch();
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

// 9. Reconnect overlay shows and clears, view unchanged.
const before = await page.getByTestId('match').getAttribute('data-step');
await stub((r) => r.simulateReconnect(600));
ok('reconnect overlay visible', (await page.getByTestId('conn').getAttribute('data-status')) === 'reconnecting');
await page.waitForTimeout(900);
ok('reconnect overlay gone, same step', (await page.getByTestId('conn').getAttribute('data-status')) === 'open' && (await page.getByTestId('match').getAttribute('data-step')) === before);

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
ok('moderator console hides unapproved powers (remove/abort/narration)', (await page.locator('[data-testid=abort], [data-testid=mod-say]').count()) === 0 && !/Remove player/.test(await page.getByTestId('mod-console').innerText()));
ok('moderator console shows no ballots text', !/Yes \d+ · No|ballot:/i.test(await page.getByTestId('mod-console').innerText()));
// drive to day.confirm via stub and apply yes count
await stub((r) => { r.closeStep(); r.closeStep(); const g = r.game.match; const alive = g.seats.filter((s) => s.alive).map((s) => s.seat); const acc = alive[1]; alive.filter((s) => s !== acc).forEach((s) => r.drive({ type: 'vote.nominate', seat: s, target: acc })); r.closeStep(); r.closeStep(); });
await page.waitForTimeout(150);
ok('moderator at day.confirm', (await page.getByTestId('mod-step').textContent()) === 'Verdict');
await page.getByTestId('yes-count').fill('7');
await page.getByTestId('yes-apply').click();
await page.waitForTimeout(150);
ok('yes count applied -> executed and step moved on', (await page.getByTestId('mod-step').textContent()) !== 'Verdict' && !(await page.locator('[data-testid=error]').count()));

// 12. Full automatic match with bots in live mode: run until ended (speed via stub).
await open('lobby', '&live=1');
await stub((r) => { r.players.forEach((p) => (p.ready = true)); r.speed = 40; r.autoBots = true; r.start(); });
let ended = false;
for (let i = 0; i < 120 && !ended; i++) { await page.waitForTimeout(500); ended = (await page.locator('[data-testid=match]').getAttribute('data-step').catch(() => null)) === 'ended'; }
ok('full automatic match with bots reaches ended', ended);
if (ended) ok('end reveal shows every role', (await page.locator('[data-testid=ended] .seat-chip .tag').count()) === 8);

ok('no page errors', errs.length === 0);
if (errs.length) console.log(errs.slice(0, 5));
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
