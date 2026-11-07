// Run log_results.mjs first to generate the screenshot fixture.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5178';
const fixture = JSON.parse(await readFile('scratch/log-results/fixture.json', 'utf8'));
await mkdir('scratch/tabletop-log', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base + '/?lang=zh-CN&model=off&view=DEV');
  await page.waitForSelector('.board-country');
  if (await page.locator('#mode-choice-dev').isVisible()) await page.locator('#mode-choice-dev').click();
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => [...document.fonts].some(f => f.family === 'Source Han Serif' && f.status === 'loaded')));
  const snapshot = () => page.evaluate(() => JSON.stringify({ engine: window.__wb.engine.snapshot(), logs: window.__wb.session.logs }));
  const initial = await snapshot();
  await page.evaluate(logs => { const w = window.__wb; w.shown = { ...w.shown, action_logs: logs }; w.renderLogStream(); }, fixture);
  await page.locator('[data-dock-tab=log]').click();
  await page.locator('#decision-panel [data-collapse-panel]').click();
  const log = page.locator('#action-log-stream');
  assert.equal(await log.locator('.result-us').count(), 1); assert.equal(await log.locator('.result-ussr').count(), 1);
  assert.equal(await log.locator('.result-arrow').count(), 5);
  assert.equal(await log.locator('details,[data-step],.trace-chip').count(), 0);
  assert(!(await log.innerText()).includes('rolls'));
  const title = log.locator('.result-ussr .result-title');
  assert((await title.innerText()).includes('#34 禁止核试验'));
  await title.locator('.log-card').hover();
  await page.waitForSelector('#card-tooltip:not(.hidden)');
  await page.mouse.move(650, 600);
  assert.equal(await snapshot(), initial);
  await page.screenshot({ path: 'scratch/tabletop-log/desktop.png' });
  await page.locator('#vtt-dock').screenshot({ path: 'scratch/tabletop-log/results.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  assert(await log.locator('.result-card').evaluateAll(cards => cards.every(c => c.scrollWidth <= c.clientWidth + 1)));
  await page.screenshot({ path: 'scratch/tabletop-log/mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  // A long history must overflow the scrollport, never shrink and crop its cards.
  const longHistory = Array.from({ length: 30 }, (_, round) => fixture.map(item => ({
    ...item, turn: round + 1, step_index: round * 10 + item.step_index,
  }))).flat();
  await page.evaluate(logs => { const w = window.__wb; w.shown = { ...w.shown, action_logs: logs }; w.renderLogStream(); }, longHistory);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 812 });
    for (const expanded of [true, false]) {
      await page.locator('#decision-panel [data-collapse-panel]').click();
      assert.equal(await page.locator('#decision-panel').evaluate(el => !el.classList.contains('vtt-minimized')), expanded);
      assert(await log.evaluate(el => el.scrollHeight > el.clientHeight + 500), 'long history scrolls');
      const cropped = await log.locator('.result-card').evaluateAll(cards => cards
        .filter(c => c.scrollHeight > c.clientHeight + 1)
        .map(c => ({ height: c.clientHeight, content: c.scrollHeight })));
      assert.deepEqual(cropped, [], `cards retain complete height at ${width}px, action expanded=${expanded}`);
      await log.evaluate(el => { el.scrollTop = 0; });
      assert.equal(await log.evaluate(el => el.scrollTop), 0);
      await log.evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert(await log.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 2), 'last result is reachable');
    }
    await page.screenshot({ path: `scratch/tabletop-log/long-history-${width}.png` });
  }
  assert.equal(await snapshot(), initial);
  await page.setViewportSize({ width: 1440, height: 900 });
  // Real legal moves, and their actual replay, use the same summary adapter.
  await page.evaluate(() => { const w = window.__wb; w.refresh(); let n = 0;
    while (w.state.current_phase !== 2 && !w.state.is_terminal && n++ < 100) w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean));
  });
  assert(await page.evaluate(() => window.__wb.state.current_phase === 2));
  const headline = log.locator('.result-system').filter({ has: page.locator('.result-headline') });
  assert.equal(await headline.count(), 1); assert.equal(await headline.locator('.result-headline').count(), 2);
  assert.equal(await headline.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(41, 40, 37)');
  await headline.screenshot({ path: 'scratch/tabletop-log/headline.png' });
  const replay = await page.evaluate(() => window.__wb.session.replay());
  const live = await snapshot();
  await page.locator('#input-replay-file').setInputFiles({ name: 'result-log.tslog.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replay)) });
  await page.waitForFunction(() => window.__wb.isReplayMode && window.__wb.replaySteps.length > 0);
  const last = log.locator('.result-card').last();
  await last.click(); assert.equal(await page.evaluate(() => window.__wb.replayCurrentStep), replay.steps.length - 1);
  await log.locator('.result-card').first().focus(); await page.keyboard.press('Enter');
  assert((await page.evaluate(() => window.__wb.replayCurrentStep)) < replay.steps.length - 1);
  assert.equal(await snapshot(), live);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ sourceHanLoaded: true, sideColours: true, resultArrows: true, tooltip: true, mobile: true, longHistoryUncropped: true, headlineOneNeutralCard: true, replayNavigation: true, engineUnchanged: true, errors }));
} finally { await browser.close(); }
