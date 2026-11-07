// Requires the optional local Hanon artwork pack and a built preview server.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:5178',out='scratch/tabletop-art';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'/?lang=zh-CN&model=off&view=DEV');await page.waitForSelector('.board-country');
 await page.evaluate(()=>{const w=window.__wb,s=structuredClone(w.shown);s.current_phase=2;s.action_round=1;s.recent_rolls=[{type:'OLYMPIC_GAMES',roller:'USSR',roll1:1,mod1:2,roll2:2,mod2:0,success:true,when:'T1 Headline',net_delta:2}];w.mapView.render(s)});
 const assets=await page.locator('.counter-art image').evaluateAll(es=>[...new Set(es.map(e=>e.getAttribute('href')))]);
 assert.equal(assets.length,10);
 for(const url of assets)assert((await page.request.get(base+'/'+url.replace(/^\//,''))).ok(),url);
 const geometry=await page.evaluate(()=>[...document.querySelectorAll('.counter-art')].map(e=>({name:e.dataset.asset,size:Number(e.getAttribute('width')),pointer:getComputedStyle(e).pointerEvents})));
 for(const a of geometry){assert(a.size>18&&a.size<=30,JSON.stringify(a));assert.equal(a.pointer,'none')}
 assert.equal(await page.locator('.board-country').count(),84);
 assert.equal(await page.locator('#board-tracks > g:not([data-track])').count(),0,'redundant caption removed');
 assert.notEqual(await page.locator('[data-track=space-US]').getAttribute('transform'),await page.locator('[data-track=space-USSR]').getAttribute('transform'));
 assert.equal(await page.locator('.roll-row').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(29, 28, 26, 0.87)');
 await page.mouse.move(1900,1050);await page.screenshot({path:out+'/board-counters.png'});
 await page.locator('.svg-region-badge').first().hover();
 assert.equal(await page.locator('.svg-region-badge rect').first().evaluate(e=>getComputedStyle(e).fill),'rgb(74, 66, 53)');
 await page.mouse.move(1900,1050);
 await page.evaluate(()=>{const w=window.__wb,s=w.shown,dt=s.decision_context.decision_type,ids=s.legal_actions.valid_ids;w.analysisPanel.lastAnalysis={decision_type:dt,decision_player:s.decision_context.decision_player,policy:{argmax_idx:0},choices:ids.map((id,i)=>({idx:i,primary_id:id,flags:0,p:1/ids.length}))};w.analysisPanel.decorate(s)});
 assert(await page.locator('.board-country rect.trace-choice-badge').count()>0);
 for(const badge of await page.locator('.board-country rect.trace-choice-badge').all()){
  assert(await badge.evaluate(e=>{const y=Number(e.getAttribute('y'));return [...e.parentElement.querySelectorAll('.inf-box')].every(b=>Number(b.getAttribute('y'))+Number(b.getAttribute('height'))<y)}));
 }
 // Display a play-mode decision to inspect the transient dice input.
 await page.evaluate(()=>{const w=window.__wb,s=structuredClone(w.shown),dt=w.engine.layout.decision_types.SELECT_PLAY_MODE;s.decision_context={...s.decision_context,decision_type:dt,decision_player:'USSR',pending_op_card:21,pending_op_card_name:'NATO',pending_ops_value:4,resolving_card:0};s.legal_actions={...s.legal_actions,decision_type:dt,valid_ids:Object.values(w.engine.layout.resolutions)};w.actionHud.render(s);w.redecorate()});
 assert.equal(await page.locator('.die-roll-selector-container').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(255, 255, 255, 0.024)');
 await page.screenshot({path:out+'/dice-input.png'});
 // Expose real card choices, then click near each corner, including the border.
 await page.evaluate(()=>{const w=window.__wb,s=structuredClone(w.shown),dt=w.engine.layout.decision_types.SELECT_CARD;s.decision_context={...s.decision_context,decision_type:dt,decision_player:'US'};s.legal_actions={...s.legal_actions,decision_type:dt,valid_ids:[5,21,23]};w.cardsView.render(s)});
 let cornerClicks=0;
 for(const viewport of [{width:1920,height:1080},{width:375,height:812}]){
  await page.setViewportSize(viewport);
  for(const dock of [false,true]){
   if(dock)await page.locator('[data-dock-tab=log]').click();
   for(const id of ['#decision-panel','#text-card-picker']){
    const panel=page.locator(id);
    for(const [fx,fy] of [[0,0],[1,0],[0,1],[1,1]]){
     await panel.locator('[data-collapse-panel]').click();
     const box=await panel.boundingBox();assert.equal(Math.round(box.width),40);
     const point={x:box.x+(fx?box.width-1:1),y:box.y+(fy?box.height-1:1)};
     const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.outerHTML.slice(0,400),point);
     await page.mouse.click(point.x,point.y);
     assert(!(await panel.evaluate(e=>e.classList.contains('vtt-minimized'))),`${id} corner ${fx},${fy} dock ${dock} viewport ${viewport.width} ${JSON.stringify(box)} hit ${hit}`);cornerClicks++;
    }
   }
   if(dock)await page.locator('[data-dock-tab=log]').click();
  }
 }
 // Counter-pack failure must retain usable countries, numeric influence, and track values.
 const fallback=await browser.newPage();await fallback.route('**/personal/counters/*',r=>r.fulfill({status:404,body:'missing'}));
 await fallback.goto(base+'/?lang=zh-CN&model=off&view=DEV');await fallback.waitForSelector('.board-country');
 await fallback.waitForFunction(()=>document.querySelectorAll('.counter-art').length===0);
 assert.equal(await fallback.locator('.board-country').count(),84);assert(await fallback.locator('.inf-num').count()>0);assert.equal(await fallback.locator('[data-track=defcon]').getAttribute('data-value'),'5');
 await page.setViewportSize({width:1440,height:900});
 const remnants=[];
 async function audit(label){remnants.push(...await page.evaluate(label=>[...document.querySelectorAll('body *')].filter(e=>e instanceof HTMLElement&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>({area:label,tag:e.tagName,id:e.id,cls:e.className,bg:getComputedStyle(e).backgroundColor})).filter(e=>['rgb(30, 41, 59)','rgb(15, 23, 42)','rgb(17, 24, 39)','rgb(11, 17, 32)','rgb(51, 65, 85)'].includes(e.bg)),label))}
 for(const tab of ['log','analysis','model','settings']){
  const button=page.locator(`[data-dock-tab=${tab}]`);if(await button.count()){await button.click();await audit(tab);await button.click()}
 }
 await page.locator('.board-space-details').click();await audit('space');await page.keyboard.press('Escape');
 await page.locator('#btn-toggle-debug').click();await audit('debug');await page.keyboard.press('Escape');
 await page.evaluate(()=>window.__wb.resultDialog.open({winner:'US',margin:20,endTurn:4,reason:'',model:'',submitted:false,summary:{human_side:'US',model_side:null,models:[],searches:[]}}));await audit('result');await page.keyboard.press('Escape');
 await page.goto(base+'/leaderboard.html');await page.waitForLoadState('domcontentloaded');await audit('leaderboard');await page.screenshot({path:out+'/leaderboard.png'});
 assert.deepEqual(remnants,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({originalTextures:assets.length,fullCellMarkers:geometry.length,cornerClicks,neutralDiceUI:true,numericFallback:true,paletteAudit:true,errors}));
} finally {await browser.close()}
