const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifest=JSON.parse(await readFile('web/ui/src/effects/steam-icons.json','utf8'));
const base=process.argv[2]||'http://127.0.0.1:5178';
await mkdir('scratch/tabletop-effects',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'/?lang=zh-CN&model=off&view=DEV');await page.waitForSelector('.board-country');
 const before=await page.evaluate(()=>JSON.stringify(window.__wb.engine.snapshot()));
 // Every extracted image is present and matches the reviewed original export.
 for(const [name,asset] of Object.entries(manifest.assets)){
  const response=await page.request.get(base+'/personal/effects/'+name+'.png');assert(response.ok(),name);
  assert.equal(createHash('sha256').update(await response.body()).digest('hex'),asset.sha256,name);
 }
 const flags=Object.keys(manifest.flags);
 await page.evaluate(flags=>{const w=window.__wb;w.cardsView.render({...w.shown,flags,space:{US:8,USSR:0}})},flags);
 assert.equal(await page.locator('.vtt-effect').count(),flags.length+4);
 await page.locator('.vtt-effect img').evaluateAll(imgs=>Promise.all(imgs.map(im=>im.decode())));
 for(const [flag,name] of Object.entries(manifest.flags)){
  const button=page.locator(`[data-effect="${flag}"]`);assert((await button.locator('img').getAttribute('src')).endsWith('/'+name+'.png'));
  assert.equal((await button.innerText()).trim(),'');assert(await button.getAttribute('aria-label'));
 }
 // Reordering/removing an effect cannot change another effect's picture.
 await page.evaluate(()=>{const w=window.__wb;w.cardsView.render({...w.shown,flags:['NATO_ACTIVE','CONTAINMENT_ACTIVE'],space:{US:0,USSR:0}})});
 assert((await page.locator('[data-effect=NATO_ACTIVE] img').getAttribute('src')).endsWith('/Icon_Nato01.png'));
 const nato=page.locator('[data-effect=NATO_ACTIVE]');await nato.focus();await page.keyboard.press('Enter');
 assert((await page.locator('#modal-body').innerText()).length>20);await page.keyboard.press('Escape');
 // Space perks disappear as soon as the other player reaches the same boxes.
 for(const side of ['US','USSR']){
  await page.evaluate(side=>{const w=window.__wb;w.cardsView.render({...w.shown,flags:[],space:{US:side==='US'?8:0,USSR:side==='USSR'?8:0}})},side);
  for(const box of [2,4,6,8])assert((await page.locator(`[data-effect="space-${side}-${box}"] img`).getAttribute('src')).endsWith(`/SpaceRace_0${box}.png`));
 }
 await page.evaluate(()=>{const w=window.__wb;w.cardsView.render({...w.shown,flags:[],space:{US:8,USSR:8}})});assert.equal(await page.locator('.vtt-effect').count(),0);
 // Unknown/internal states have a neutral question icon rather than an unrelated card.
 await page.evaluate(()=>{const w=window.__wb;w.cardsView.render({...w.shown,flags:['SPACE_US_ATTEMPT_1'],space:{US:0,USSR:0}})});
 assert((await page.locator('.vtt-effect img').getAttribute('src')).endsWith('/Icon_Ask01.png'));
 // A failed optional image keeps the button accessible and its details usable.
 await page.route('**/personal/effects/Icon_Chernobyl01.png',r=>r.fulfill({status:404,body:'missing'}));
 await page.evaluate(()=>{const w=window.__wb;w.cardsView.render({...w.shown,flags:['CHERNOBYL_ACTIVE'],space:{US:0,USSR:0}})});
 await page.waitForSelector('[data-effect=CHERNOBYL_ACTIVE] svg');await page.locator('[data-effect=CHERNOBYL_ACTIVE]').click();assert(await page.locator('#modal-container').isVisible());await page.keyboard.press('Escape');
 await page.unroute('**/personal/effects/Icon_Chernobyl01.png');
 // Representative real-size screenshots, including mobile and translated permanent effects.
 const example=['NATO_ACTIVE','CONTAINMENT_ACTIVE','PURGE_US_ACTIVE','QUAGMIRE_ACTIVE','BEAR_TRAP_ACTIVE','FLOWER_POWER_ACTIVE','SHUTTLE_DIPLOMACY_ACTIVE','NORAD_ACTIVE'];
 await page.evaluate(flags=>{const w=window.__wb;w.cardsView.render({...w.shown,flags,space:{US:0,USSR:0}})},example);
 await page.locator('.vtt-effect img').evaluateAll(imgs=>Promise.all(imgs.map(im=>im.decode())));
 await page.screenshot({path:'scratch/tabletop-effects/desktop.png'});
 await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),375);await page.screenshot({path:'scratch/tabletop-effects/mobile.png'});
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__wb.engine.snapshot())),before);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({verifiedAssets:Object.keys(manifest.assets).length,cardStates:flags.length,spacePerks:8,stableMapping:true,keyboardDetails:true,unknownFallback:true,missingImageFallback:true,mobile:true,engineUnchanged:true,errors}));
} finally {await browser.close()}
