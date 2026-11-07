const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = process.argv[2] || 'http://127.0.0.1:5178';
await mkdir('scratch/tabletop-space', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base + '/?lang=zh-CN&model=off&view=DEV'); await page.waitForSelector('.board-country');
  if (await page.locator('#mode-choice-dev').isVisible()) await page.locator('#mode-choice-dev').click();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#chk-filter-vp').count(), 0);
  const emoji = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u2680-\u2685\uFE0F\u2605\u2713\u2715]/u;
  const assertPlain = async () => assert(!emoji.test((await page.locator('body').innerText()).replace(/[©®™]/g, '')), 'visible UI has no emoji');
  const snapshot = () => page.evaluate(() => JSON.stringify({ engine: window.__wb.engine.snapshot(), logs: window.__wb.session.logs, steps: window.__wb.session.steps }));
  const before = await snapshot();
  await page.locator('.board-space-details').click();
  const stages = page.locator('.space-stage');
  assert.deepEqual(await stages.evaluateAll(es => es.map(e => +e.dataset.box)), [1,2,3,4,5,6,7,8]);
  await page.locator('.space-stage-picture img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
  assert.equal(new Set(await stages.evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().top)))).size, 1);
  assert(await page.locator('.space-track-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'eight stages fit the desktop window');
  const art = JSON.parse(await readFile('web/ui/src/space/steam-track.json', 'utf8'));
  for (const asset of Object.values(art.stages)) {
    const r = await page.request.get(base + '/personal/space/' + asset.name + '.png');
    assert(r.ok()); assert.equal(createHash('sha256').update(await r.body()).digest('hex'), asset.sha256);
  }
  const engineBoxes = await page.evaluate(() => window.__wb.engine.layout.space_boxes);
  for (let i = 1; i <= 8; i++) {
    const stats = await stages.nth(i - 1).locator('dd').allTextContents();
    assert.deepEqual(stats, [engineBoxes[i].min_ops+'+', '1–'+engineBoxes[i].max_roll, engineBoxes[i].vp_first+' 胜利点数', engineBoxes[i].vp_second+' 胜利点数']);
  }
  for (const [us, ussr, held] of [[2,0,1],[4,2,1],[6,0,3],[8,6,1],[8,8,0],[0,8,4]]) {
    await page.evaluate(([US,USSR]) => { const w=window.__wb, s={...w.shown,space:{US,USSR}}; w.mapView.trackDetails.updateState(s); w.mapView.trackDetails.showSpaceRaceModal(s); }, [us,ussr]);
    assert.equal(await page.locator('.space-stage-perk.perk-held').count(), held);
    assert.equal(await stages.locator('.space-position').count(), Number(us>0)+Number(ussr>0));
  }
  await assertPlain();
  await page.locator('#modal-container .modal-content').screenshot({ path: 'scratch/tabletop-space/desktop.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(new Set(await stages.evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().top)))).size, 1);
  const rail = page.locator('.space-track-scroll');
  assert(await rail.evaluate(el => el.scrollWidth > el.clientWidth + 500));
  await rail.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  assert(await rail.evaluate(el => Math.abs(el.scrollWidth - el.clientWidth - el.scrollLeft) < 2));
  await page.screenshot({ path: 'scratch/tabletop-space/mobile.png' });
  await page.locator('#modal-close').click();
  assert(!(await page.locator('#modal-container').isVisible()));
  assert.equal(await snapshot(), before);
  await page.setViewportSize({ width: 1600, height: 950 });
  // Select and resolve an actual UN Intervention in a legal engine game.
  await page.evaluate(() => {
    const w=window.__wb,L=w.engine.layout; let found=false;
    for(let seed=1;seed<80;seed++) {
      w.session.newGame(seed);w.refresh();let n=0;
      while(w.state.current_phase!==2&&!w.state.is_terminal&&n++<80)w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean));
      if(w.state.current_phase===2&&w.state.legal_actions.valid_ids.includes(L.card_ids.UN_INTERVENTION)){found=true;break;}
    }
    if(!found)throw Error('No UN Intervention fixture');
    w.handleCardClick(L.card_ids.UN_INTERVENTION);
    w.sendAction({decision_type:L.decision_types.SELECT_PLAY_MODE,primary_id:L.resolutions.EVENT});
  });
  assert.match(await page.locator('#decision-body').innerText(), /联合国干预.*选择一张对方事件牌/s);
  const paired = await page.evaluate(() => { const w=window.__wb,id=w.state.legal_actions.valid_ids.find(x=>x>=1&&x<=110); w.handleCardClick(id); return id; });
  assert.equal(paired, 27);
  assert.match(await page.locator('#decision-body').innerText(), /美日共同防卫协定/);
  await page.evaluate(() => { const w=window.__wb; w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean)); });
  await page.locator('[data-dock-tab=log]').click();
  const last = page.locator('#action-log-stream .result-card').last();
  const text = await last.innerText();
  assert.match(text,/美日共同防卫协定/); assert.match(text,/已弃置/); assert.match(text,/事件，随后行动点数：影响力/);
  assert(!/[A-Za-z]{3}/.test(text),text); await assertPlain();
  await last.screenshot({ path: 'scratch/tabletop-space/un-intervention.png' });
  // The grouped log must translate both event-first sides and multi-event chains in the DOM.
  const afterUN = await snapshot();
  const mixedModes = ['US', 'USSR'].flatMap(side => ['Influence', 'Coup', 'Realignment'].map(op => `${side} Event first, then Ops: ${op}`));
  mixedModes.push('Ops: Coup, then the US Event, then Ops: Realignment', 'USSR Event First, Then Op: Coup');
  await page.evaluate(modes => {
    const w = window.__wb;
    w.shown = { ...w.shown, action_logs: modes.flatMap((mode, i) => {
      const base = { turn: 2, ar: i + 1, phase: 'ACTION_ROUND', player: 'US', text: '', details: [] };
      return [{ ...base, step_index: i * 2 + 1, kind: 'play', title: 'US plays Nuclear Test Ban (#34)', cards: [34] },
        { ...base, step_index: i * 2 + 2, kind: 'mode', mode }];
    }) }; w.renderLogStream();
  }, mixedModes);
  const translatedModes = await page.locator('#action-log-stream .result-mode').allTextContents();
  assert.equal(translatedModes.length, mixedModes.length);
  assert(translatedModes.every(s => !/[A-Za-z]/.test(s)), JSON.stringify(translatedModes));
  assert.equal(await snapshot(), afterUN);
  await page.evaluate(() => window.__wb.renderState());
  // Language switching uses the same data; English UI is also free of pictographs.
  await page.locator('[data-dock-tab=settings]').click(); await page.locator('[data-locale-select]').selectOption('en');
  await page.keyboard.press('Escape'); await page.locator('.board-space-details').click();
  assert.match(await page.locator('.space-track-window').innerText(), /First arrival/); await assertPlain();
  await page.keyboard.press('Escape');
  await page.route('**/personal/space/*.png', route => route.abort());
  await page.locator('.board-space-details').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.space-art-fallback')].every(e => !e.hidden));
  assert.equal(await stages.count(),8);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({eightOriginalSprites:true,horizontalDesktopAndMobile:true,engineTrackValues:true,occupantsAndPerks:true,noEmoji:true,noVpFilter:true,unInterventionChinese:true,languageSwitch:true,missingArtFallback:true,errors}));
} finally { await browser.close(); }
