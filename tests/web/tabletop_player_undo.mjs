// Run against the personal tabletop with its real WASM engine.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const base = process.argv[2] || 'http://127.0.0.1:5178';
  await page.goto(base + '/?view=ussr&model=off&lang=zh-CN');
  await page.waitForSelector('.board-country');
  const undo = page.locator('#btn-undo-action');
  const confirm = page.locator('#btn-confirm-action');
  const hand = page.locator('#text-card-picker');
  const position = () => page.evaluate(() => window.__wb.engine.saveJson());
  const choose = () => page.evaluate(() => {
    const w = window.__wb;
    w.handleCountryClick(w.state.legal_actions.valid_ids[0]);
  });
  async function checkLayout() {
    const [u, h, rail] = await Promise.all([undo.boundingBox(), hand.boundingBox(), page.locator('[data-dock-tab=log]').boundingBox()]);
    assert.equal(u.x, h.x);
    assert.equal(u.width, rail.width);
    assert(u.y + u.height < h.y && h.y - u.y - u.height < 10);
  }
  assert(await undo.isDisabled());
  assert(await confirm.isHidden());
  await checkLayout();
  await page.setViewportSize({ width: 390, height: 844 });
  await hand.locator('[data-collapse-panel]').click();
  await checkLayout();
  await hand.locator('[data-collapse-panel]').click();
  await checkLayout();
  await page.setViewportSize({ width: 1366, height: 900 });
  const initial = await position();
  await choose();
  await choose();
  await page.keyboard.press('Control+z');
  await undo.click();
  assert.equal(await position(), initial);
  assert(await undo.isDisabled());

  // Reload preserves the current seat's uncommitted history.
  await choose();
  await page.waitForFunction(() => window.__wb.liveState.position === new URL(location.href).searchParams.get('pos') && !!window.__wb.liveState.position);
  await page.reload();
  await page.waitForSelector('.board-country');
  await undo.click();
  assert.equal(await position(), initial);

  for (let n = 0; n < 5; n++) await choose();
  const fifth = await position();
  const placement = await page.evaluate(() => {
    const w = window.__wb;
    const target = Object.values(w.state.countries).find(country => country.id === w.state.legal_actions.valid_ids[0]);
    return { name: target.name, value: target.ussr_influence };
  });
  const marker = page.locator(`.board-country[data-name="${placement.name}"] .inf-num-ussr`);
  assert(await undo.isEnabled());
  await choose();
  assert(await confirm.isVisible());
  assert.equal(await confirm.getAttribute('aria-label'), '确认行动');
  assert.equal(await confirm.getAttribute('title'), '确认行动');
  assert.equal(await confirm.innerText(), '');
  assert(await confirm.locator('svg path').isVisible());
  assert.equal(await position(), fifth);
  assert.equal(await page.evaluate(() => window.__wb.session.record().steps.length), 5);
  assert.equal(await marker.textContent(), String(placement.value + 1));
  await page.evaluate(() => window.__wb.renderState());
  assert.equal(await marker.textContent(), String(placement.value + 1));

  const logTool = page.locator('[data-dock-tab=log]');
  async function toolStyle(button) {
    return button.evaluate(async el => {
      const s = getComputedStyle(el);
      await Promise.all(el.getAnimations().map(animation => animation.finished));
      return [s.backgroundColor, s.borderTopColor, s.borderRadius, s.color, s.width, s.height];
    });
  }
  const normal = await toolStyle(logTool);
  assert.notEqual(normal[0], 'rgba(0, 0, 0, 0)');
  assert.deepEqual(await toolStyle(confirm), normal);
  await logTool.hover();
  const hovered = await toolStyle(logTool);
  assert.notEqual(hovered[0], normal[0]);
  await confirm.hover();
  assert.deepEqual(await toolStyle(confirm), hovered);
  await page.setViewportSize({ width: 390, height: 844 });
  await hand.locator('[data-collapse-panel]').click();
  const [u, c] = await Promise.all([undo.boundingBox(), confirm.boundingBox()]);
  assert.equal(c.y, u.y);
  assert.equal(c.width, u.width);
  assert(c.x > u.x + u.width);
  await hand.locator('[data-collapse-panel]').click();
  await page.setViewportSize({ width: 1366, height: 900 });
  await undo.click();
  assert(await confirm.isHidden());
  assert.equal(await position(), fifth);
  assert.equal(await marker.textContent(), String(placement.value));
  await choose();
  await confirm.click();
  assert.equal(await marker.textContent(), String(placement.value + 1));
  assert.equal(await page.evaluate(() => window.__wb.session.record().steps.length), 6);
  assert(await page.evaluate(() => window.__wb.hiddenSideToMove()));
  assert(await undo.isDisabled());
  const committed = await position();
  assert.notEqual(committed, fifth);
  await page.keyboard.press('Control+z');
  assert.equal(await position(), committed);
  // Drive the opponent from its legal mask, just as auto-play does, until we move again.
  await page.evaluate(() => {
    const w = window.__wb;
    for (let i = 0; w.hiddenSideToMove() && i < 20; i++)
      w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean), 0, true);
    if (w.hiddenSideToMove()) throw Error('Opponent did not finish setup');
  });
  const afterOpponent = await position();
  assert(await undo.isDisabled());
  await page.keyboard.press('Escape');
  assert.equal(await position(), afterOpponent);

  // US bonus setup ends with Iran 1 -> 2. Preview the number and control before committing.
  await page.evaluate(() => {
    const w = window.__wb;
    w.setView('DEV');
    w.session.newGame(1); w.refresh();
    for (let i = 0; i < 14; i++) w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean), 0);
    if (!w.state.legal_actions.valid_ids.includes(25) || w.state.countries.Iran.us_influence !== 1)
      throw Error('Iran bonus setup fixture changed');
    w.setView('US');
  });
  const iranBefore = await position();
  const iran = page.locator('.board-country[data-name="Iran"]');
  await iran.locator('.country-card-bg').click();
  assert(await confirm.isVisible());
  assert.equal(await iran.locator('.inf-num-us').textContent(), '2');
  assert.equal(await iran.getAttribute('data-control'), 'US');
  assert.equal(await position(), iranBefore);
  await page.evaluate(() => window.__wb.renderState());
  assert.equal(await iran.locator('.inf-num-us').textContent(), '2');
  await undo.click();
  assert.equal(await iran.locator('.inf-num-us').textContent(), '1');
  assert.equal(await iran.getAttribute('data-control'), 'NONE');
  await iran.locator('.country-card-bg').click();
  await confirm.click();
  assert.equal(await iran.locator('.inf-num-us').textContent(), '2');
  assert.equal(await page.evaluate(() => window.__wb.engine.display().countries.Iran.us_influence), 2);
  assert(await undo.isDisabled());

  // The player can also withdraw a suggested Space Race attempt before the roll.
  await page.evaluate(() => {
    const w = window.__wb;
    w.setView('DEV');
    w.session.newGame(1); w.refresh();
    const first = () => Array.from(w.engine.mask(false)).findIndex(Boolean);
    for (let i = 0; w.state.current_phase !== 2 && i < 100; i++) w.sendFlatAction(first(), 0);
    const side = w.state.decision_context.decision_player;
    const space = w.engine.layout.offsets.play_mode + w.engine.layout.resolutions.SPACE;
    for (const card of w.state.legal_actions.valid_ids) {
      w.handleCardClick(card);
      if (w.engine.mask(false)[space]) {
        w.setView(side);
        window.spaceChoice = space;
        return;
      }
      w.session.undo(false); w.refresh();
    }
    throw Error('Fixture has no legal space attempt');
  });
  const preRoll = await position();
  await page.evaluate(() => window.__wb.sendFlatAction(window.spaceChoice));
  assert(await confirm.isVisible());
  assert.equal(await position(), preRoll);
  await page.keyboard.press('Escape');
  assert(await confirm.isHidden());
  assert.equal(await position(), preRoll);
  await page.evaluate(() => window.__wb.sendFlatAction(window.spaceChoice));
  await confirm.click();
  assert(await page.evaluate(() => window.__wb.session.steps.at(-1).rolls.length > 0));
  assert(await undo.isDisabled());
  const rolled = await position();
  assert.notEqual(rolled, preRoll);
  await page.keyboard.press('Control+z');
  assert.equal(await position(), rolled);
  assert.deepEqual(errors, []);
  console.log('Player undo, confirmation, handoff, roll, reload and toolbar styles passed.');
} finally {
  await browser.close();
}
