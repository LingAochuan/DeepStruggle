const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined});
try {
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));
 await p.goto((process.argv[2]||'http://127.0.0.1:5178')+'/?lang=zh-CN&model=off&view=DEV');
 await p.waitForSelector('.board-country');
 const panel=p.locator('#text-card-picker'),rows=p.locator('.vtt-text-card');
 const ids=()=>rows.evaluateAll(es=>es.map(e=>Number(e.dataset.cardId)));
 // The real setup places influence: the whole hand remains readable but cannot play.
 assert(await panel.isVisible());assert(await rows.count()>0);assert.equal(await p.locator('.vtt-text-card:enabled').count(),0);
 const initial=await ids(),before=await p.evaluate(()=>window.__wb.session.steps.length);
 await rows.first().dispatchEvent('click');assert.equal(await p.evaluate(()=>window.__wb.session.steps.length),before);
 await rows.first().hover();assert(await p.locator('#card-tooltip').isVisible());await p.mouse.move(1400,880);
 await panel.locator('[data-collapse-panel]').click();
 await p.evaluate(()=>{const w=window.__wb;w.handleCountryClick(w.state.legal_actions.valid_ids[0])});
 assert(await panel.isVisible());assert(await panel.evaluate(e=>e.classList.contains('vtt-minimized')));
 assert.deepEqual(await ids(),initial);await panel.locator('[data-collapse-panel]').click();
 let moves=0;while(await p.evaluate(()=>window.__wb.state.current_phase===0)){
  await p.evaluate(()=>{const w=window.__wb;w.handleCountryClick(w.state.legal_actions.valid_ids[0])});assert(++moves<30);
 }
 assert(await p.locator('.vtt-text-card:enabled').count()>0);
 await p.locator('.vtt-text-card:enabled').first().click();assert(await panel.isVisible());
 // Resolve real headlines, then play a real Ops card for influence.
 await p.evaluate(()=>{const w=window.__wb,L=w.engine.layout;let n=0;while(!(w.state.current_phase===2&&w.state.decision_context.decision_type===L.decision_types.SELECT_CARD)){if(++n>60||w.state.is_terminal)throw Error('No action round');w.sendFlatAction(Array.from(w.engine.mask(false)).findIndex(Boolean),0)}const id=w.state.legal_actions.valid_ids.find(id=>w.cardsView.cardsMeta.get(id)?.ops>0);w.handleCardClick(id)});
 const influence=await p.evaluate(()=>window.__wb.engine.layout.resolutions.OPS_INFLUENCE);
 await p.locator(`#decision-body [data-primary="${influence}"]`).click();
 assert(await panel.isVisible());assert.equal(await p.locator('.vtt-text-card:enabled').count(),0);
 assert(await rows.count()>0);
 assert(await p.evaluate(()=>window.__wb.state.decision_context.decision_type===window.__wb.engine.layout.decision_types.POINT_NODE));
 // Player view holds the player's hand even during a redacted opponent decision.
 await p.evaluate(()=>{const w=window.__wb,s=structuredClone(w.shown);s.view='US';s.view_hidden_decision=true;s.hands={US:[21,23],USSR:[]};s.china_card={holder:'USSR',playable:false};s.legal_actions={...s.legal_actions,valid_ids:[]};s.decision_context={...s.decision_context,decision_player:'USSR'};w.cardsView.render(s)});
 assert.deepEqual(await ids(),[21,23]);assert.equal(await p.locator('#text-card-picker-title').textContent(),'美国手牌');assert.equal(await p.locator('.vtt-text-card:enabled').count(),0);
 // An event choice from another pile is available below the hand, never lost or miscounted.
 await p.evaluate(()=>{const w=window.__wb,s=structuredClone(w.shown),dt=w.engine.layout.decision_types.SELECT_CARD;s.view='US';s.view_hidden_decision=false;s.hands={US:[21,23],USSR:[]};s.china_card={holder:'US',playable:false};s.decision_context={...s.decision_context,decision_type:dt,decision_player:'US'};s.legal_actions={...s.legal_actions,decision_type:dt,valid_ids:[5]};w.cardsView.render(s)});
 assert.deepEqual(await ids(),[21,23,6,5]);assert.equal(await p.locator('#text-card-picker-count').textContent(),'3');assert.deepEqual(await p.locator('.vtt-text-card:enabled').evaluateAll(es=>es.map(e=>Number(e.dataset.cardId))),[5]);assert.equal(await panel.locator('.vtt-card-list-note').textContent(),'选择卡牌');
 // Empty/terminal hands retain the shell and collapse preference; replays are read-only.
 await panel.locator('[data-collapse-panel]').click();
 await p.evaluate(()=>{const w=window.__wb,s=structuredClone(w.shown);s.view='US';s.is_terminal=true;s.hands={US:[],USSR:[]};s.china_card={holder:'USSR',playable:false};w.cardsView.render(s)});
 assert(await panel.isVisible());assert(await panel.evaluate(e=>e.classList.contains('vtt-minimized')));await panel.locator('[data-collapse-panel]').click();assert.equal(await panel.locator('.vtt-card-list-note').textContent(),'暂无手牌');
 await p.evaluate(()=>{document.body.classList.add('replay-view');window.__wb.cardsView.render(window.__wb.shown)});assert(await rows.count()>0);assert.equal(await p.locator('.vtt-text-card:enabled').count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({setupAndOpsHand:true,manualCollapsePersists:true,readonlyTooltip:true,noIllegalPlay:true,headlineChoice:true,playerPrivacy:true,eventPileChoice:true,chinaCard:true,emptyHand:true,replayReadonly:true,errors}));
} finally {await browser.close()}
