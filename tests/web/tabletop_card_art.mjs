const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.argv[2]||'http://127.0.0.1:5178';
const manifest=JSON.parse(await readFile('web/ui/src/cards/hanon-art.json','utf8'));
await mkdir('scratch/tabletop-card-art',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'/?lang=zh-CN&model=off&view=DEV');await page.waitForSelector('.board-country');
 if(await page.locator('#mode-choice-dev').isVisible())await page.locator('#mode-choice-dev').click();
 for(const [id,asset]of Object.entries(manifest.cards)){
  const response=await page.request.get(base+'/personal/cards/'+asset.file);assert(response.ok(),id);
  assert.equal(createHash('sha256').update(await response.body()).digest('hex'),asset.sha256,id);
 }
 const snapshot=()=>page.evaluate(()=>JSON.stringify({state:window.__wb.engine.snapshot(),logs:window.__wb.session.logs,steps:window.__wb.session.steps}));
 const preview=async(id)=>{
  const img=page.locator('#card-tooltip.hanon-card-preview img');await img.waitFor();await img.evaluate(el=>el.decode());
  assert((await img.getAttribute('src')).endsWith('/'+String(id).padStart(3,'0')+'.webp'));
  const box=await page.locator('#card-tooltip').boundingBox(),size=page.viewportSize();
  assert(box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1,'preview stays inside viewport');
 };
 // Reach a real, legally playable UN Intervention, then inspect its paired-card reference.
 await page.evaluate(()=>{
  const w=window.__wb,L=w.engine.layout;let found=false;
  for(let seed=1;seed<80;seed++){w.session.newGame(seed);w.refresh();let n=0;while(w.state.current_phase!==2&&!w.state.is_terminal&&n++<80)w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean));if(w.state.current_phase===2&&w.state.legal_actions.valid_ids.includes(L.card_ids.UN_INTERVENTION)){found=true;break}}
  if(!found)throw Error('No UN fixture');w.handleCardClick(L.card_ids.UN_INTERVENTION);w.sendAction({decision_type:L.decision_types.SELECT_PLAY_MODE,primary_id:L.resolutions.EVENT});w.handleCardClick(w.state.legal_actions.valid_ids.find(x=>x>=1&&x<=110));
 });
 const before=await snapshot(),ref=page.locator('#decision-body .log-card').first(),id=Number(await ref.getAttribute('data-card-id'));
 await ref.hover();await preview(id);await page.screenshot({path:'scratch/tabletop-card-art/current-action.png'});
 await page.mouse.move(700,400);assert.equal(await page.locator('#card-tooltip.hanon-card-preview').count(),0);
 await ref.focus();await preview(id);await page.keyboard.press('Tab');
 assert.equal(await snapshot(),before);
 // The live hand uses its separate fixed preview, while retaining the text-list layout.
 const hand=page.locator('.vtt-text-card').first();await hand.hover();await page.waitForSelector('#hand-card-preview:not(.hidden) img');assert(await page.locator('#card-tooltip').isHidden());
 assert.equal(await page.locator('#text-card-picker img').count(),0);
 await page.mouse.move(700,400);
 await page.evaluate(()=>{const w=window.__wb;w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean))});
 await page.locator('[data-dock-tab=log]').click();const logRef=page.locator('#action-log-stream .log-card').last();await logRef.scrollIntoViewIfNeeded();await logRef.hover();await preview(Number(await logRef.getAttribute('data-card-id')));
 await page.screenshot({path:'scratch/tabletop-card-art/action-log.png'});await page.mouse.move(700,400);
 const afterPlay=await snapshot();
 await page.evaluate(()=>{const w=window.__wb;w.cardsView.render({...w.shown,flags:['QUAGMIRE_ACTIVE','NATO_CANCELED_FRANCE'],space:{US:8,USSR:0}})});
 const trap=page.locator('[data-effect=QUAGMIRE_ACTIVE]');await trap.hover();await preview(42);assert.equal(await trap.getAttribute('title'),null);
 await page.screenshot({path:'scratch/tabletop-card-art/effect.png'});
 await page.locator('[data-effect=NATO_CANCELED_FRANCE]').focus();await preview(17);
 await page.locator('[data-effect=space-US-2]').hover();assert(await page.locator('#card-tooltip').isHidden());assert(await page.locator('[data-effect=space-US-2]').getAttribute('title'));
 await page.locator('.board-country').first().hover({force:true});assert(!(await page.locator('#card-tooltip').getAttribute('class')).includes('hanon-card-preview'));
 await page.setViewportSize({width:375,height:812});
 await page.evaluate(()=>window.__wb.cardsView.showCardTooltip(new MouseEvent('mouseover',{clientX:370,clientY:805}),42));await preview(42);
 await page.screenshot({path:'scratch/tabletop-card-art/mobile.png'});
 // Failed artwork uses engine-aligned text; delayed failures cannot replace a newer preview.
 await page.route('**/personal/cards/042.webp',r=>r.fulfill({status:404,body:'missing'}));
 await page.evaluate(()=>window.__wb.cardsView.showCardTooltip(new MouseEvent('mouseover',{clientX:10,clientY:20}),42));
 await page.waitForFunction(()=>!document.querySelector('#card-tooltip').classList.contains('hanon-card-preview'));
 assert((await page.locator('#card-tooltip').innerText()).includes('泥潭'));
 await page.unroute('**/personal/cards/042.webp');
 let finish;const pending=new Promise(resolve=>finish=resolve);let requested;const started=new Promise(resolve=>requested=resolve);
 await page.route('**/personal/cards/042.webp',async r=>{requested();await pending;await r.fulfill({status:404,body:'late'})});
 await page.evaluate(()=>window.__wb.cardsView.showCardTooltip(new MouseEvent('mouseover',{clientX:10,clientY:20}),42));await started;
 await page.evaluate(()=>window.__wb.cardsView.showCardTooltip(new MouseEvent('mouseover',{clientX:10,clientY:20}),43));await preview(43);finish();await page.waitForLoadState('networkidle');await preview(43);
 assert.equal(await snapshot(),afterPlay);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({verifiedCards:110,currentAction:true,actionLog:true,effectMapping:true,keyboard:true,handUnchanged:true,spacePerkText:true,countryTooltipRestored:true,mobile:true,missingArtFallback:true,staleRequestSafe:true,hoverPreservesState:true,errors}));
}finally{await browser.close()}
