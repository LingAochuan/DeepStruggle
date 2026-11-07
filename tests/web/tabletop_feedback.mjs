const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const out=process.env.TABLETOP_ARTIFACTS || 'scratch/tabletop-feedback';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH || undefined});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.argv[2]||'http://127.0.0.1:5178')+'/?lang=zh-CN&model=off&view=DEV');await page.waitForSelector('.board-country');
 assert.equal(await page.locator('#vtt-right-tools button').count(),4);assert.equal(await page.locator('#vtt-dock-toggle').count(),0);
 assert.equal(await page.locator('#decision-body').evaluate(el=>[...el.querySelectorAll('*')].filter(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1).length),0);
 const action=page.locator('#decision-panel');await action.locator('[data-collapse-panel]').click();assert.equal(await action.locator('[data-collapse-panel]').textContent(),'+');assert(!(await page.locator('#decision-body').isVisible()));assert.equal(Math.round((await action.boundingBox()).width),40);
 await page.locator('[data-dock-tab=log]').click();assert.equal(await action.evaluate(el=>el.parentElement.id),'vtt-dock-action-slot');assert.equal(await action.locator('[data-collapse-panel]').textContent(),'+');await action.locator('[data-collapse-panel]').click();assert(await page.locator('#decision-body').isVisible());await page.locator('[data-dock-tab=log]').click();
 // One Apply changes the edited tracks and countries together; untouched country remains intact.
 const before=await page.evaluate(()=>structuredClone(window.__wb.state.countries));
 await page.locator('#btn-toggle-debug').click();assert.equal(await page.locator('#dbg-form button').count(),1);
 const uk=await page.evaluate(()=>window.__wb.mapView.mapData.countries.find(c=>c.name==='United Kingdom').id);await page.locator('#dbg-country-select').selectOption(String(uk));
 assert.equal(await page.locator('#dbg-us-inf').inputValue(),String(before['United Kingdom'].us_influence));
 await page.locator('#dbg-defcon').fill('3');await page.locator('#dbg-vp').fill('4');await page.locator('#dbg-apply-all').click();
 assert.equal(await page.evaluate(()=>window.__wb.state.defcon),3);assert.equal(await page.evaluate(()=>window.__wb.state.victory_points),4);assert.deepEqual(await page.evaluate(()=>window.__wb.state.countries),before);
 await page.locator('#btn-toggle-debug').click();
 const finland=await page.evaluate(()=>window.__wb.mapView.mapData.countries.find(c=>c.name==='Finland').id);
 const austria=await page.evaluate(()=>window.__wb.mapView.mapData.countries.find(c=>c.name==='Austria').id);
 await page.locator('#dbg-country-select').selectOption(String(finland));await page.locator('#dbg-us-inf').fill('2');await page.locator('#dbg-country-select').selectOption(String(austria));await page.locator('#dbg-ussr-inf').fill('3');await page.locator('#dbg-country-select').selectOption(String(finland));assert.equal(await page.locator('#dbg-us-inf').inputValue(),'2');await page.locator('#dbg-apply-all').click();
 assert.equal(await page.evaluate(()=>window.__wb.state.countries.Finland.us_influence),2);assert.equal(await page.evaluate(()=>window.__wb.state.countries.Austria.ussr_influence),3);
 // No-op Apply creates no debug event and an invalid form changes nothing.
 const events=await page.evaluate(()=>window.__wb.session.events.length);await page.locator('#btn-toggle-debug').click();await page.locator('#dbg-apply-all').click();assert.equal(await page.evaluate(()=>window.__wb.session.events.length),events);
 await page.locator('#btn-toggle-debug').click();await page.locator('#dbg-defcon').fill('8');await page.locator('#dbg-apply-all').click();assert(await page.locator('#modal-container').isVisible());assert.equal(await page.evaluate(()=>window.__wb.session.events.length),events);await page.keyboard.press('Escape');
 // Inject a deterministic analysis readout, using the real badge renderer, never a model download.
 await page.evaluate(()=>{
   const w=window.__wb,s=structuredClone(w.shown),dt=w.engine.layout.decision_types.SELECT_CARD;
   s.decision_context={...s.decision_context,decision_type:dt,decision_player:'US'};s.legal_actions={...s.legal_actions,decision_type:dt,valid_ids:[5,21,23]};
   w.cardsView.render(s);w.analysisPanel.lastAnalysis={decision_type:dt,decision_player:'US',policy:{argmax_idx:1},choices:[5,21,23].map((id,i)=>({idx:i,primary_id:id,flags:0,p:i===1?0.95:0.025}))};w.analysisPanel.decorate(s);
 });
 assert.equal(await page.locator('.vtt-text-card .trace-choice-badge').count(),3);
 for(const row of await page.locator('.vtt-text-card:has(.trace-choice-badge)').all()){
   const a=await row.locator('.vtt-card-ops').boundingBox(),b=await row.locator('.trace-choice-badge').boundingBox();assert(a.x+a.width<=b.x,JSON.stringify({a,b}));
 }
 await page.screenshot({path:out+'/card-probabilities.png'});
 const cards=page.locator('#text-card-picker');await cards.locator('[data-collapse-panel]').click();assert.equal(Math.round((await cards.boundingBox()).width),40);assert(!(await page.locator('#text-card-picker-list').isVisible()));await cards.locator('[data-collapse-panel]').click();assert(await page.locator('#text-card-picker-list').isVisible());
 // Render every play mode in both languages and exercise the shared card tooltip.
 for(const locale of ['en','zh-CN']){
   await page.locator('[data-dock-tab=settings]').click();await page.locator('[data-locale-select]').selectOption(locale);await page.locator('[data-dock-tab=settings]').click();
   await page.evaluate(()=>{const w=window.__wb,s=structuredClone(w.shown),dt=w.engine.layout.decision_types.SELECT_PLAY_MODE;s.decision_context={...s.decision_context,decision_type:dt,decision_player:'USSR',pending_op_card:21,pending_op_card_name:'NATO',pending_ops_value:4,resolving_card:0};s.legal_actions={...s.legal_actions,decision_type:dt,valid_ids:Object.values(w.engine.layout.resolutions)};w.actionHud.render(s);w.redecorate()});
   const text=await page.locator('#decision-body').innerText();assert(!text.includes('[object Object]'));
   const first=page.locator('#decision-body .btn-choice-card').first();const lines=await first.locator(':scope > div').all();assert((await lines[0].boundingBox()).y<(await lines[1].boundingBox()).y);
   assert(text.includes(locale==='en'?'Resolve the Event':'结算事件'),locale+': '+text);
   const ref=page.locator('#decision-body .log-card[data-card-id="21"]').first();await ref.hover();assert(await page.locator('#card-tooltip').isVisible());assert((await page.locator('#card-tooltip').innerText()).includes(locale==='en'?'NATO':'北大西洋公约组织'));
   await page.mouse.move(1400,880);await page.locator('#decision-body [data-roll="2"]').click();assert.equal(await page.locator('#decision-body .log-card[data-card-id="21"]').count(),1);
 }
 await page.screenshot({path:out+'/play-mode-translated.png'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({fourTools:true,singleScrollbar:true,bothPanelsMinimize:true,unifiedDebugApply:true,noUneditedCountryReset:true,multipleCountryDrafts:true,noOpAndInvalidForm:true,probabilitiesSeparate:true,hudCardTooltips:true,playModesBilingual:true,errors}));
} finally {await browser.close()}
