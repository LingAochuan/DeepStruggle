// Run against a built, served UI with its matching WASM engine. No model download is needed.
// node tests/web/i18n_browser.mjs http://127.0.0.1:5173
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
});
const base = process.argv[2] || "http://127.0.0.1:5173";
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route("https://huggingface.co/**", route => route.abort());
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
const ready = () => page.waitForFunction(() => window.__wb?.state, { timeout: 15000 });
const switchTo = lang => page.locator("[data-locale-select]").first().selectOption(lang);
const snapshot = () => page.evaluate(() => {
  const w = window.__wb;
  return { position: w.engine.saveJson(), id: w.session.id, steps: JSON.stringify(w.session.steps),
    logs: JSON.stringify(w.session.logs), history: w.session.history.length };
});
try {
  await page.goto(`${base}/?model=off&view=dev`);
  await ready();
  await page.evaluate(() => { window.__wb.session.newGame(6); window.__wb.refresh(); });
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.locator("#btn-new-game").innerText(), "New Game");
  const opening = await snapshot();
  await page.evaluate(() => {
    const w = window.__wb;
    w.sendFlatAction(w.engine.mask(false).findIndex(Boolean), 0, true);
  });
  const moved = await snapshot();
  assert.notEqual(moved.position, opening.position);
  await switchTo("zh-CN");
  assert.deepEqual(await snapshot(), moved);
  assert.equal(await page.locator("#btn-new-game").innerText(), "新游戏");
  assert.equal(new URL(page.url()).searchParams.get("model"), "off");
  await switchTo("en");
  assert.deepEqual(await snapshot(), moved);
  await page.click("#btn-undo-action");
  assert.equal((await snapshot()).position, opening.position);

  // Open modal: translating must retain unsaved field values.
  await page.click("#btn-toggle-debug");
  await page.locator("#dbg-vp").fill("7");
  await page.locator("#dbg-country-select").selectOption("32");
  await page.locator("#dbg-us-inf").fill("4");
  await switchTo("zh-CN");
  assert.equal(await page.locator("#dbg-vp").inputValue(), "7");
  assert.equal(await page.locator("#dbg-country-select").inputValue(), "32");
  assert.equal(await page.locator("#dbg-us-inf").inputValue(), "4");
  assert.equal(await page.locator("#dbg-apply-vp").innerText(), "设置胜利点数");
  await page.click("#modal-close");

  // Drive the opening with the same legal-action path as the upstream browser tests.
  await page.evaluate(() => {
    const w = window.__wb;
    for (let n = 0; n < 100 && w.state.current_phase_name !== "HEADLINE"; n++)
      w.sendFlatAction(w.engine.mask(false).findIndex(Boolean), 0, true);
    if (w.state.current_phase_name !== "HEADLINE") throw new Error("opening did not reach headline");
    w.setView("US");
  });
  const privateView = await page.evaluate(() => {
    const w = window.__wb;
    const { position, ...shown } = w.shown; // The share token is encoded asynchronously.
    return { shown, hidden: w.state.hands.USSR.filter(id => w.state.card_locations[id] === "HAND_USSR_UNKNOWN") };
  });
  assert.ok(privateView.hidden.length);
  for (const id of privateView.hidden) assert.ok(!privateView.shown.hands.USSR.includes(id));
  await switchTo("en");
  assert.deepEqual(await page.evaluate(() => { const { position, ...shown } = window.__wb.shown; return shown; }), privateView.shown);
  await switchTo("zh-CN");
  await page.evaluate(() => window.__wb.setView("DEV"));

  // Reload a position link: language, record identity, undo and exact position survive.
  await page.waitForFunction(() => !!new URL(location.href).searchParams.get("pos"));
  const saved = await snapshot();
  await page.reload();
  await ready();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  const restored = await snapshot();
  for (const key of ["position", "id", "history"]) assert.equal(restored[key], saved[key], `reload changed ${key}`);
  assert.equal(JSON.parse(restored.steps).length, JSON.parse(saved.steps).length);

  // In replay, switch labels without moving the cursor or modifying the live engine.
  await page.evaluate(() => window.__wb.replayControls.loadReplayData(window.__wb.session.replay()));
  await page.click("#btn-rep-last");
  const replay = await page.evaluate(() => ({ step: window.__wb.replayCurrentStep, state: window.__wb.state }));
  await switchTo("en");
  assert.equal(await page.locator("#btn-toggle-replay").innerText(), "Live Mode");
  assert.deepEqual(await page.evaluate(() => ({ step: window.__wb.replayCurrentStep, state: window.__wb.state })), replay);
  await switchTo("zh-CN");
  assert.equal(await page.locator("#btn-toggle-replay").innerText(), "对局模式");
  await page.click("#btn-toggle-replay");
  assert.equal((await snapshot()).position, saved.position);

  // Hand tooltips and the action HUD are display translations, including mode choices.
  const handCard = page.locator("[data-card-id]").filter({ visible: true }).first();
  await handCard.hover();
  await page.locator("#card-tooltip").waitFor({ state: "visible" });
  assert.match(await page.locator("#card-tooltip").innerText(), /[\u4e00-\u9fff]/);
  await page.mouse.move(0, 0);
  const modeCount = await page.evaluate(() => {
    const w = window.__wb;
    let modes = 0;
    for (let n = 0; n < 60 && !w.state.is_terminal; n++) {
      if (w.state.decision_context.decision_type === w.engine.layout.decision_types.SELECT_PLAY_MODE) modes++;
      const text = document.body.innerText;
      if (text.includes("[object Object]")) throw new Error("object rendered as a label");
      w.sendFlatAction(w.engine.mask(false).findIndex(Boolean), 0, true);
    }
    return modes;
  });
  assert.ok(modeCount > 0, "exercise card mode selection");

  // A fresh dialog and fresh page both use the saved preference; a URL can override it.
  await page.click("#btn-new-game");
  assert.match(await page.locator("#mode-dialog-title").innerText(), /如何|游玩|模式/);
  await switchTo("en");
  assert.equal(await page.locator("#mode-dialog-title").innerText(), "How do you want to play?");
  await page.click("#mode-dialog-close");
  await switchTo("zh-CN");
  await page.goto(`${base}/?model=off&view=dev`);
  await ready();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Chinese UI overflows mobile viewport");
  await page.goto(`${base}/?model=off&view=dev&lang=en`);
  await ready();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");

  await page.goto(`${base}/leaderboard.html?lang=zh-CN`);
  await page.waitForFunction(() => document.querySelector("#lb-body")?.children.length > 0);
  const rows = await page.locator("#lb-body tr").count();
  assert.equal(await page.locator("#lb-tab-ratings-btn").innerText(), "评分");
  await switchTo("en");
  assert.equal(await page.locator("#lb-tab-ratings-btn").innerText(), "Ratings");
  assert.equal(await page.locator("#lb-body tr").count(), rows);
  assert.deepEqual(errors, []);
  console.log("i18n browser checks passed: defaults, game round trip, undo, modal fields, privacy, reload, replay, card tooltips/modes, persistence, mobile, leaderboard.");
} finally { await browser.close(); }
