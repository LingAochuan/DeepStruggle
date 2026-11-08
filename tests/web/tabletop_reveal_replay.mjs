// Real-engine CIA, one-shot reveal privacy/lifecycle, replay timers, and imported HTML regression.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
await mkdir('scratch/tabletop-reveal', { recursive: true });
const metadata = JSON.parse(await readFile('rules/cards.json', 'utf8'));
const gunman = metadata.find(c => c.name.includes('Lone Gunman')).id;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto((process.argv[2] || 'http://127.0.0.1:5178') + '/?lang=zh-CN&model=off&view=DEV');
  await page.waitForSelector('.board-country');
  if (await page.locator('#mode-choice-dev').isVisible()) await page.locator('#mode-choice-dev').click();
  const cards = page.locator('#hand-reveal-dialog [data-card-id]');
  const dialog = page.locator('#hand-reveal-dialog');
  const snapshot = () => page.evaluate(() => window.__wb.engine.saveJson());
  const expected = await page.evaluate(() => {
    const w = window.__wb, L = w.engine.layout;
    w.session.newGame(1); w.refresh();
    for (let n = 0; w.state.current_phase !== 2 && n < 100; n++) w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean), 0);
    if (!w.state.legal_actions.valid_ids.includes(26)) throw Error('CIA fixture no longer legal');
    w.handleCardClick(26);
    w.setView('US');
    // The opponent's model triggers CIA; the human US must get its view of the revealed USSR hand.
    w.sendFlatAction(L.offsets.play_mode + L.resolutions.EVENT, 0, true);
    return w.shown.hands.USSR;
  });
  assert(expected.length > 0);
  await dialog.waitFor({ state: 'visible' });
  assert.deepEqual(await cards.evaluateAll(es => es.map(e => Number(e.dataset.cardId))), expected);
  assert.equal(await dialog.locator('button').innerText(), '关闭');
  await page.waitForFunction(() => [...document.querySelectorAll('#hand-reveal-dialog img')].every(i => i.complete && i.naturalWidth));
  const state = await snapshot();
  await page.evaluate(() => {
    const w = window.__wb;
    w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean), 0, true);
    w.refresh();
    const select = document.querySelector('[data-locale-select]'); select.value = 'en'; select.dispatchEvent(new Event('change'));
  });
  assert.equal(await snapshot(), state);
  assert.equal(await dialog.locator('button').innerText(), 'Close');
  await page.evaluate(() => {
    const select = document.querySelector('[data-locale-select]'); select.value = 'zh-CN'; select.dispatchEvent(new Event('change'));
  });
  assert.equal(await dialog.locator('button').innerText(), '关闭');
  await page.waitForFunction(() => [...document.querySelectorAll('#hand-reveal-dialog img')].every(i => i.complete && i.naturalWidth));
  await page.screenshot({ path: 'scratch/tabletop-reveal/cia-desktop.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
  assert(await dialog.locator('.hand-reveal-row').evaluate(e => e.scrollWidth > e.clientWidth));
  await page.screenshot({ path: 'scratch/tabletop-reveal/cia-mobile.png' });
  await dialog.locator('button').click();
  await page.evaluate(() => window.__wb.refresh());
  assert(await dialog.isHidden()); assert.equal(await cards.count(), 0);
  assert.equal(await snapshot(), state);

  // Undo/replay the real event: a genuinely new execution opens it again, ordinary renders don't.
  await page.evaluate(() => {
    const w = window.__wb, L = w.engine.layout;
    w.session.undo(); w.refresh();
    w.sendFlatAction(L.offsets.play_mode + L.resolutions.EVENT, 0, true);
  });
  assert(await dialog.isVisible());
  await page.evaluate(() => {
    const w = window.__wb;
    window.__autoTest = { pick: w.analysisPanel.autoPlayMove, send: w.sendFlatAction, calls: 0 };
    w.analysisPanel.autoPlayMove = () => 1;
    w.sendFlatAction = () => { window.__autoTest.calls++; };
    w.maybeAutoPlay();
  });
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.__autoTest.calls), 0);
  await page.keyboard.press('Escape'); assert(await dialog.isHidden());
  assert.equal(await snapshot(), state); // Escape closes, never undoes.
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.__autoTest.calls), 1);
  await page.evaluate(() => {
    const w = window.__wb;
    w.analysisPanel.autoPlayMove = window.__autoTest.pick;
    w.sendFlatAction = window.__autoTest.send;
    delete window.__autoTest;
  });

  // A hand that was already known still displays once when CIA fires; locale/view redraws don't trigger it.
  await page.evaluate(() => {
    const w = window.__wb, after = structuredClone(w.shown), before = structuredClone(after);
    before.decision_context.decision_type = w.engine.layout.decision_types.SELECT_PLAY_MODE;
    w.handReveal.observe(before, after, w.engine.layout);
  });
  assert(await dialog.isVisible());
  await page.evaluate(() => window.__wb.setView('USSR'));
  assert(await dialog.isHidden()); assert.equal(await cards.count(), 0);

  // Lone Gunman uses the same display, with only engine-known US cards; newly revealed subsets work too.
  await page.route('**/personal/cards/**', route => route.abort());
  await page.evaluate(gunman => {
    const w = window.__wb, after = structuredClone(w.shown), before = structuredClone(after);
    after.hands.US = [5, 7]; after.card_locations = { 5: 'HAND_US_KNOWN', 7: 'UNSEEN' };
    after.decision_context = { ...after.decision_context, decision_player: 'USSR', decision_type: w.engine.layout.decision_types.SELECT_OP_MODE, pending_op_card: gunman };
    before.decision_context.pending_op_card = 0;
    w.handReveal.observe(before, after, w.engine.layout);
  }, gunman);
  assert.deepEqual(await cards.evaluateAll(es => es.map(e => +e.dataset.cardId)), [5]);
  await page.waitForFunction(() => document.querySelector('#hand-reveal-dialog .hand-reveal-fallback')?.textContent && !document.querySelector('#hand-reveal-dialog img'));
  await dialog.locator('button').click();
  await page.unroute('**/personal/cards/**');

  // A partial reveal shows only newly known cards, and never opens for the owner of that hand.
  await page.evaluate(() => {
    const w = window.__wb, after = structuredClone(w.shown), before = structuredClone(after);
    after.hands.US = [1, 2, 5]; after.card_locations = { 1: 'HAND_US_KNOWN', 2: 'UNSEEN', 5: 'HAND_US_KNOWN' };
    before.card_locations = { 1: 'UNSEEN', 2: 'UNSEEN', 5: 'HAND_US_KNOWN' };
    after.decision_context.pending_op_card = before.decision_context.pending_op_card = 0;
    w.handReveal.observe(before, after, w.engine.layout);
  });
  assert.deepEqual(await cards.evaluateAll(es => es.map(e => +e.dataset.cardId)), [1]);
  await dialog.locator('button').click();
  await page.evaluate(() => {
    const w = window.__wb, after = structuredClone(w.shown), before = structuredClone(after);
    after.view = before.view = 'US'; after.hands.US = [1];
    after.card_locations = { 1: 'HAND_US_KNOWN' }; before.card_locations = { 1: 'HAND_US_UNKNOWN' };
    w.handReveal.observe(before, after, w.engine.layout);
  });
  assert(await dialog.isHidden());

  // Stop on leaving replay, switching to player mode, replacing a replay, and starting a new game.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const checkStopped = async operation => {
    const before = await page.evaluate(operation => {
      const w = window.__wb;
      w.setView('DEV'); w.replayControls.loadReplayData(w.session.replay());
      document.querySelector('#rep-speed-select').value = '500';
      w.replayControls.play(); w.replayControls.play();
      if (operation === 'live') w.setReplayMode(false);
      if (operation === 'view') w.setView('US');
      if (operation === 'load') w.replayControls.loadReplayData(w.session.replay());
      if (operation === 'new') w.newGame('DEV');
      return { replay: w.isReplayMode, view: w.view, step: w.replayControls.currentStep, playing: w.replayControls.isPlaying };
    }, operation);
    assert.equal(before.playing, false);
    await page.waitForTimeout(650);
    const after = await page.evaluate(() => {
      const w = window.__wb; return { replay: w.isReplayMode, view: w.view, step: w.replayControls.currentStep, playing: w.replayControls.isPlaying };
    });
    assert.deepEqual(after, before);
  };
  for (const operation of ['live', 'view', 'load', 'new']) await checkStopped(operation);

  // Import the original hostile replay shape: card IDs must never become executable HTML.
  await page.evaluate(() => {
    const w = window.__wb, s = structuredClone(w.shown);
    s.current_phase_name = 'ACTION_ROUND'; s.decision_context.resolving_card = 0;
    s.decision_context.decision_type = w.engine.layout.decision_types.SELECT_CARD;
    s.decision_context.decision_player = 'US';
    const common = { turn: 1, ar: 1, phase: 'ACTION_ROUND', player: 'US', state_snapshot: s, description: 'fixture' };
    w.replayControls.loadReplayData({ steps: [
      { ...common, step_index: 0, action: { decision_type: 0, primary_id: 0 } },
      { ...common, step_index: 1, action: { decision_type: w.engine.layout.decision_types.SELECT_CARD, primary_id: '17</span><img src=x onerror="window.__replayXss=1">' } },
    ] });
  });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__replayXss), undefined);
  assert.equal(await page.locator('#action-log-stream img').count(), 0);
  assert.deepEqual(errors, []);
  console.log('CIA reveal, i18n, privacy, close/undo, mobile, missing art, replay timer lifecycle and imported replay XSS passed.');
} finally { await browser.close(); }
