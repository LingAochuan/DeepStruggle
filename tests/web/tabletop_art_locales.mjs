// Locale artwork, camera/hit testing, and missing/late image responses against the real UI.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5178';
const manifest = JSON.parse(await readFile('web/ui/src/artwork/english-sources.json', 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
await mkdir('scratch/tabletop-art-locales', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base + '/?lang=en&model=off&view=DEV');
  await page.waitForSelector('.board-country');
  if (await page.locator('#mode-choice-dev').isVisible()) await page.locator('#mode-choice-dev').click();
  for (const asset of [manifest.board, ...Object.values(manifest.counters), ...Object.values(manifest.cards)]) {
    const response = await page.request.get(base + '/personal/' + asset.file);
    assert(response.ok(), asset.file);
    assert.equal(createHash('sha256').update(await response.body()).digest('hex'), asset.sha256, asset.file);
  }
  const change = lang => page.evaluate(lang => {
    const select = document.querySelector('[data-locale-select]'); select.value = lang; select.dispatchEvent(new Event('change'));
  }, lang);
  const ready = lang => page.waitForFunction(file => document.querySelector('.board-art')?.getAttribute('href')?.endsWith(file), lang === 'en' ? 'board-en.jpg' : 'hanon-board.jpg');
  const snapshot = () => page.evaluate(() => JSON.stringify({ state: window.__wb.engine.saveJson(), steps: window.__wb.session.steps, logs: window.__wb.session.logs }));
  const camera = () => page.locator('.board-art').evaluate(e => e.ownerSVGElement.ownerSVGElement.getAttribute('viewBox'));
  const geometry = () => page.locator('.board-country > .country-card-bg').evaluateAll(es => es.map(e => ['x','y','width','height'].map(k => e.getAttribute(k))));
  await ready('en'); assert.equal(await page.locator('.board-country').count(), 84);
  const boxes = await geometry();
  await page.mouse.move(700,400); await page.mouse.wheel(0,-160); await page.waitForTimeout(100);
  await page.mouse.move(650,350); await page.mouse.down(); await page.mouse.move(700,380,{steps:6}); await page.mouse.up();
  const beforeClick = await snapshot(); await page.locator('.board-country.legal-target').first().click();
  assert.notEqual(await snapshot(), beforeClick, 'legal country playable after pan/zoom');
  const state = await snapshot(), view = await camera();
  for (const lang of ['zh-CN','en']) {
    await change(lang); await ready(lang);
    for (const name of ['turn','defcon']) assert((await page.locator(`.counter-art[data-asset="${name}"] image`).getAttribute('href')).endsWith(`counters/${lang === 'en' ? 'en/' : ''}${name}.png`));
    assert.equal(await snapshot(),state); assert.equal(await camera(),view); assert.deepEqual(await geometry(),boxes);
    await page.locator('.vtt-text-card').first().hover();
    const img = page.locator('#hand-card-preview:not(.hidden) img'); await img.waitFor(); await img.evaluate(e=>e.decode());
    assert.equal((await img.getAttribute('src')).includes('/cards/en/'),lang === 'en'); await page.mouse.move(700,400);
  }
  await page.screenshot({path:'scratch/tabletop-art-locales/english-board.png'});
  // Public previews all use the shared localized renderer; real UN pairing exercises the HUD/log.
  await page.evaluate(() => {
    const w=window.__wb,L=w.engine.layout; let found=false;
    for(let seed=1;seed<80;seed++) { w.session.newGame(seed); w.refresh(); let n=0;
      while(w.state.current_phase!==2&&!w.state.is_terminal&&n++<80) w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean));
      if(w.state.current_phase===2&&w.state.legal_actions.valid_ids.includes(L.card_ids.UN_INTERVENTION)){found=true;break;}
    }
    if(!found)throw Error('No UN fixture'); w.handleCardClick(L.card_ids.UN_INTERVENTION);
    w.sendAction({decision_type:L.decision_types.SELECT_PLAY_MODE,primary_id:L.resolutions.EVENT}); w.handleCardClick(w.state.legal_actions.valid_ids.find(x=>x>=1&&x<=110));
  });
  const hover = async locator => {
    await locator.hover(); const img=page.locator('#card-tooltip.hanon-card-preview img'); await img.waitFor(); await img.evaluate(e=>e.decode());
    assert((await img.getAttribute('src')).includes('/cards/en/')); await page.mouse.move(700,400);
  };
  await hover(page.locator('#decision-body .log-card').first());
  await page.evaluate(()=>{const w=window.__wb;w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean));});
  await page.locator('[data-dock-tab=log]').click(); const log=page.locator('#action-log-stream .log-card').last(); await log.scrollIntoViewIfNeeded(); await hover(log);
  await page.evaluate(()=>{const w=window.__wb;w.cardsView.render({...w.shown,flags:['QUAGMIRE_ACTIVE']});}); await hover(page.locator('[data-effect=QUAGMIRE_ACTIVE]'));
  await page.evaluate(()=>{
    const w=window.__wb,L=w.engine.layout;w.session.newGame(1);w.refresh();
    for(let n=0;w.state.current_phase!==2&&n<100;n++)w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean),0);
    w.handleCardClick(26);w.setView('US');w.sendFlatAction(L.offsets.play_mode+L.resolutions.EVENT,0,true);
  });
  const dialog=page.locator('#hand-reveal-dialog');await dialog.waitFor();const revealed=await snapshot();
  for(const lang of ['en','zh-CN','en']){
    await change(lang);await ready(lang);
    await page.waitForFunction(()=>[...document.querySelectorAll('#hand-reveal-dialog img')].every(i=>i.complete&&i.naturalWidth));
    assert((await dialog.locator('img').count())>0);assert.equal(await dialog.locator('button').innerText(),lang==='en'?'Close':'关闭');
    assert((await dialog.locator('img').evaluateAll(es=>es.map(e=>e.src.includes('/cards/en/')))).every(en=>en===(lang==='en')));assert.equal(await snapshot(),revealed);
  }
  await page.screenshot({path:'scratch/tabletop-art-locales/english-reveal.png'});await dialog.locator('button').click();
  await page.route('**/personal/cards/en/042.webp',r=>r.fulfill({status:404,body:'missing'}));
  await page.evaluate(()=>window.__wb.cardsView.showCardTooltip(new MouseEvent('mouseover',{clientX:10,clientY:20}),42));
  await page.waitForFunction(()=>document.querySelector('#card-tooltip')?.textContent.includes('Quagmire'));assert.equal(await page.locator('#card-tooltip img').count(),0);
  await change('zh-CN');await ready('zh-CN');
  let release;const gate=new Promise(resolve=>release=resolve);let started;const request=new Promise(resolve=>started=resolve);
  await page.route('**/personal/board-en.jpg',async r=>{started();await gate;await r.fulfill({status:404,body:'late missing'});});
  await change('en');await request;await change('zh-CN');await ready('zh-CN');release();
  await page.waitForLoadState('networkidle');await ready('zh-CN');
  await change('en');await page.waitForSelector('.svg-country-node:not(.board-country)');assert.equal(await page.locator('.board-art').count(),0);
  await page.unroute('**/personal/board-en.jpg');await change('zh-CN');await ready('zh-CN');await change('en');await ready('en');
  assert.equal(await snapshot(),revealed);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({verifiedEnglishFiles:113,sameGeometry:true,panZoomClick:true,preservedCamera:true,hand:true,action:true,log:true,effects:true,reveal:true,missingFallback:true,staleLoads:true,errors}));
} finally { await browser.close(); }
