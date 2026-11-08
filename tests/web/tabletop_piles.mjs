import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
await mkdir('scratch/tabletop-piles', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto((process.argv[2] || 'http://127.0.0.1:5178') + '/?lang=zh-CN&model=off&view=DEV');
  await page.waitForSelector('.board-country');
  if (await page.locator('#mode-choice-dev').isVisible()) await page.locator('#mode-choice-dev').click();
  const panel = page.locator('#text-card-picker'), rows = panel.locator('.vtt-text-card');
  const tab = name => page.locator(`[data-card-pile=${name}]`);
  const ids = () => rows.evaluateAll(es => es.map(e => Number(e.dataset.cardId)));
  const snapshot = () => page.evaluate(() => JSON.stringify({ engine: window.__wb.engine.snapshot(), logs: window.__wb.session.logs, steps: window.__wb.session.steps }));
  const before = await snapshot();
  await tab('discard').click(); assert.equal(await rows.count(), 0);
  assert.equal(await panel.locator('.vtt-card-list-note').innerText(), '此牌堆为空');
  // Public pile fixtures include a legal event choice, but browsing must never play it.
  await page.evaluate(() => {
    const w = window.__wb, s = structuredClone(w.shown), dt = w.engine.layout.decision_types.SELECT_CARD;
    s.view = 'US'; s.hands = { US: [21, 23], USSR: [] }; s.china_card = { holder: 'USSR', playable: false };
    s.discard_pile = [5, 8, 13, 15, 28, 30]; s.removed_pile = [17];
    s.view_hidden_decision = false; s.decision_context = { ...s.decision_context, decision_type: dt, decision_player: 'US' };
    s.legal_actions = { ...s.legal_actions, decision_type: dt, valid_ids: [5] }; w.cardsView.render(s);
  });
  assert.deepEqual(await ids(), [5, 8, 13, 15, 28, 30]);
  assert.equal(await tab('hand').innerText(), '美国手牌');
  assert.equal(await panel.locator('#text-card-picker-count').innerText(), '6');
  assert.equal(await panel.locator('.vtt-text-card:enabled').count(), 0);
  await rows.first().dispatchEvent('click'); assert.equal(await snapshot(), before);
  await rows.first().hover(); await page.waitForSelector('#hand-card-preview:not(.hidden) img');
  const face = page.locator('#hand-card-preview img'); await face.evaluate(el => el.decode());
  const width = (await face.boundingBox()).width;
  await page.screenshot({ path: 'scratch/tabletop-piles/discard.png' });
  await tab('removed').click(); assert(await page.locator('#hand-card-preview').isHidden());
  assert.deepEqual(await ids(), [17]); await rows.first().hover();
  await page.waitForSelector('#hand-card-preview:not(.hidden) img');
  assert(Math.abs((await face.boundingBox()).width - width) < 1, 'Small piles keep the hand preview size');
  await panel.locator('[data-collapse-panel]').click(); assert(await page.locator('#hand-card-preview').isHidden());
  await panel.locator('[data-collapse-panel]').click(); assert.equal(await tab('removed').getAttribute('aria-selected'), 'true');
  await tab('removed').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await tab('hand').getAttribute('aria-selected'), 'true');
  assert.deepEqual(await ids(), [21, 23, 5]);
  assert.deepEqual(await panel.locator('.vtt-text-card:enabled').evaluateAll(es => es.map(e => Number(e.dataset.cardId))), [5]);
  await tab('discard').click();
  await page.locator('[data-dock-tab=settings]').click(); await page.locator('[data-locale-select]').selectOption('en');
  assert.equal(await tab('discard').innerText(), 'Discard pile');
  assert.equal(await tab('discard').getAttribute('aria-selected'), 'true');
  await page.locator('[data-locale-select]').selectOption('zh-CN'); await page.locator('[data-dock-tab=settings]').click();
  // Live updates/replays redraw the selected public pile, not a cached private hand.
  await page.evaluate(() => { const w = window.__wb; document.body.classList.add('replay-view'); w.cardsView.render({ ...w.shown, discard_pile: Array.from({ length: 25 }, (_, i) => i + 1) }); });
  assert.equal(await rows.count(), 25); assert.equal(await panel.locator('.vtt-text-card:enabled').count(), 0);
  await page.setViewportSize({ width: 375, height: 812 });
  await rows.first().hover(); await page.waitForSelector('#hand-card-preview:not(.hidden) img');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
  const bounds = await panel.boundingBox();
  for (const name of ['hand', 'discard', 'removed']) { const b = await tab(name).boundingBox(); assert(b.x >= bounds.x && b.x + b.width <= bounds.x + bounds.width); }
  await page.screenshot({ path: 'scratch/tabletop-piles/mobile.png' });
  assert.equal(await snapshot(), before); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ publicPiles: true, emptyState: true, readonly: true, hover: true, stableSize: true, tabsAndCollapse: true, legalHandChoices: true, locale: true, replay: true, mobile: true, errors }));
} finally { await browser.close(); }
