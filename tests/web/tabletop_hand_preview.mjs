const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('scratch/tabletop-hand-preview',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.argv[2]||'http://127.0.0.1:5178')+'/?lang=zh-CN&model=off&view=DEV');await page.waitForSelector('.board-country');
 if(await page.locator('#mode-choice-dev').isVisible())await page.locator('#mode-choice-dev').click();
 const panel=page.locator('#text-card-picker'),rows=page.locator('.vtt-text-card'),preview=page.locator('#hand-card-preview');
 const snapshot=()=>page.evaluate(()=>JSON.stringify({engine:window.__wb.engine.snapshot(),logs:window.__wb.session.logs,steps:window.__wb.session.steps}));
 const before=await snapshot();assert.equal((await panel.boundingBox()).width,320);
 const colors=await rows.evaluateAll(es=>es.map(el=>({side:[...el.classList].find(c=>c.startsWith('side-')),color:getComputedStyle(el.querySelector('.vtt-card-name')).color})));
 for(const x of colors)assert.equal(x.color,{'side-us':'rgb(129, 171, 208)','side-ussr':'rgb(211, 145, 135)','side-neutral':'rgb(231, 226, 217)'}[x.side]);
 // A fast pass cancels the request; no hover can play a disabled setup card.
 const r=await rows.first().boundingBox();await page.mouse.move(r.x+55,r.y+10);await page.waitForTimeout(30);await page.mouse.move(1400,400);await page.waitForTimeout(140);assert(await preview.isHidden());
 await rows.first().hover();await page.waitForSelector('#hand-card-preview:not(.hidden) img');await preview.locator('img').evaluate(img=>img.decode());
 const box=await panel.boundingBox(),art=await preview.locator('img').boundingBox();assert(Math.abs(art.height-box.height-22)<2);assert.equal(art.x,box.x+box.width+12);assert(Math.abs(art.y+art.height-box.y-box.height)<2);
 const firstId=await rows.first().getAttribute('data-card-id');assert.equal(await preview.getAttribute('data-card-id'),firstId);
 await rows.nth(1).hover();await page.waitForTimeout(30);assert.equal(await preview.getAttribute('data-card-id'),firstId);await page.waitForFunction(id=>document.querySelector('#hand-card-preview').dataset.cardId===id,await rows.nth(1).getAttribute('data-card-id'));
 assert.deepEqual(await preview.locator('img').boundingBox(),art);
 await page.mouse.move(box.x+box.width+5,box.y+30);await page.waitForTimeout(250);assert(await preview.isVisible());await preview.hover();await page.waitForTimeout(250);assert(await preview.isVisible());
 await page.screenshot({path:'scratch/tabletop-hand-preview/desktop.png'});
 await panel.locator('[data-collapse-panel]').click();assert(await preview.isHidden());await page.waitForTimeout(130);assert(await preview.isHidden());await panel.locator('[data-collapse-panel]').click();
 assert.equal(await snapshot(),before);
 // A missing optional face uses localized text at exactly the same fixed position.
 const id=await rows.first().getAttribute('data-card-id'),url='**/personal/cards/'+id.padStart(3,'0')+'.webp';
 await page.route(url,route=>route.fulfill({status:404,body:'missing'}));await rows.first().hover();await page.waitForSelector('#hand-card-preview:not(.hidden) .hand-card-fallback');assert((await preview.innerText()).length>20);await page.mouse.move(1400,400);await page.unroute(url);
 // An old image cannot reopen after a state refresh / view change.
 let release,started;const delayed=new Promise(r=>release=r),requested=new Promise(r=>started=r);
 await page.route(url,async route=>{started();await delayed;await route.fulfill({status:404,body:'late'})});await rows.first().hover();await requested;
 await page.evaluate(()=>window.__wb.renderState());release();await page.waitForLoadState('networkidle');assert(await preview.isHidden());await page.unroute(url);
 // English switching preserves position and redraws a current-language image label.
 await page.locator('[data-dock-tab=settings]').click();await page.locator('[data-locale-select]').selectOption('en');await rows.first().hover();await page.waitForSelector('#hand-card-preview:not(.hidden) img');assert(/[A-Za-z]/.test(await preview.locator('img').getAttribute('alt')));
 await page.locator('[data-locale-select]').selectOption('zh-CN');assert(await preview.isHidden());assert.equal(await snapshot(),before);
 await page.setViewportSize({width:375,height:812});await rows.first().hover();await page.waitForSelector('#hand-card-preview:not(.hidden) img');const narrow=await preview.boundingBox();assert(narrow.x+narrow.width<=375&&narrow.y>=0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),375);await page.screenshot({path:'scratch/tabletop-hand-preview/mobile.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({compact:true,sideColors:true,dwell100ms:true,stableRightPreview:true,readingGap:true,collapseSafe:true,missingArtFallback:true,staleRequestSafe:true,localeRoundTrip:true,mobile:true,hoverPreservesState:true,errors}));
}finally{await browser.close()}
