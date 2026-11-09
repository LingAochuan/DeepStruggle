import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
});
const base = process.argv[2] || "http://127.0.0.1:5178";
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.route("https://huggingface.co/**", route => route.abort());
try {
  await page.goto(`${base}/?model=off&view=dev&lang=zh-CN`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__wb?.session);
  const original = await page.evaluate(() => {
    const w = window.__wb;
    w.session.newGame(42); w.seatSides();
    for (let i = 0; i < 14; i++) w.session.applyFlat(w.engine.mask(false).findIndex(Boolean), false);
    w.refresh();
    const doc = w.session.replay();
    window.testReplay = doc;
    w.replayControls.loadReplayData(doc);
    // Exercise real observations, readout softmax, critic routing and UI without a model download.
    w.model = { obsFeatures: 0, meta: { label: "Test model", mergedInfluence: false, macroInfluence: false },
      run: async (obs, masks, batch) => {
        await new Promise(r => setTimeout(r, 5));
        if (batch !== 3 || obs.length !== 3 * w.engine.obsSizeFor(0)) throw new Error("wrong observation batch");
        return { logits: new Float32Array(masks.length), vWin: new Float32Array([.1, .4, -.2]), vVp: new Float32Array([0, 0, 0]) };
      } };
    w.modelKey = "replay-test";
    w.modelLabel = { text: "Test model", status: "ready" };
    w.renderReplayAnalysis(); w.analyseReplay();
    return w.engine.saveJson();
  });
  await page.waitForFunction(() => window.__wb.replayAnalyzer.state.phase === "complete");
  assert.equal(await page.locator("#replay-analysis-panel").getAttribute("data-completed"), "14");
  assert.ok((await page.locator("#rep-analysis-status").innerText()).includes("分析完成"));
  assert.ok((await page.locator("#rep-analysis-detail").innerText()).includes("70.0%"));
  // Four tabs share one list; selecting a side survives changes of the acting player.
  assert.deepEqual(await page.locator('[data-card-pile]:visible').allTextContents(), ['美国手牌', '苏联手牌', '弃牌堆', '移出游戏']);
  for (const side of ['US', 'USSR']) {
    const tab = page.locator(`[data-card-pile="${side === 'US' ? 'hand' : 'ussr-hand'}"]`);
    await tab.click();
    for (const index of [0, 6, 13]) {
      await page.evaluate(i => window.__wb.replayControls.goToStep(i), index);
      const hand = await page.evaluate(side => {
        const s = window.__wb.replayControls.steps[window.__wb.replayCurrentStep].state_snapshot;
        return {
          expected: [...new Set([...(s.hands[side] || []), ...(s.china_card?.holder === side ? [6] : [])])],
          actual: [...document.querySelectorAll('#text-card-picker-list .vtt-text-card')].map(el => Number(el.dataset.cardId)),
        };
      }, side);
      assert.deepEqual(hand.actual, hand.expected);
      assert.equal(await tab.getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#text-card-picker-list .vtt-text-card:enabled, #text-card-picker-list [data-primary], #text-card-picker-list .trace-choice-badge').count(), 0);
    }
  }
  const handBox = await page.locator('#text-card-picker').boundingBox();
  await page.locator('[data-card-pile="discard"]').click();
  assert.deepEqual(await page.locator('#text-card-picker').boundingBox(), handBox);
  await page.locator('[data-card-pile="hand"]').click();
  const chart = page.locator("#rep-analysis-chart");
  assert.deepEqual(await chart.locator('.rep-grid-quarter').evaluateAll(lines => lines.map(l => Number(l.getAttribute('y1')))), [122.5, 51.5]);
  assert.ok(!(await chart.locator('text').allTextContents()).some(t => t === '25%' || t === '75%'));
  await chart.focus(); await page.keyboard.press("End");
  assert.equal(await page.evaluate(() => window.__wb.replayCurrentStep), 13);
  assert.equal(await page.locator("#rep-timeline-slider").inputValue(), "13");
  assert.equal(await page.locator('[data-dock-page="analysis"] #rep-timeline-slider').count(), 1);
  assert.equal(await page.locator('[data-dock-page="settings"] #rep-timeline-slider').count(), 0);
  assert.ok(await page.evaluate(() => {
    const chart = document.getElementById('rep-analysis-chart').getBoundingClientRect();
    const controls = document.getElementById('replay-toolbar').getBoundingClientRect();
    const detail = document.getElementById('rep-analysis-detail').getBoundingClientRect();
    return chart.bottom <= controls.top && controls.bottom <= detail.top;
  }));
  await page.locator("#rep-timeline-slider").fill("3");
  await page.locator("#rep-timeline-slider").dispatchEvent("input");
  assert.equal(await chart.getAttribute("aria-valuenow"), "4");
  await page.locator('#btn-rep-next').click();
  assert.equal(await chart.getAttribute("aria-valuenow"), "5");
  await page.locator('#btn-rep-prev').click();
  await page.locator('#rep-speed-select').selectOption('200');
  await page.locator('#btn-rep-play').click();
  await page.waitForFunction(() => window.__wb.replayControls.currentStep > 3);
  await page.locator('#btn-rep-play').click();
  assert.equal(await page.evaluate(() => window.__wb.replayControls.isPlaying), false);
  await page.evaluate(() => window.__wb.shell.open("settings"));
  await page.locator("[data-locale-select]").first().selectOption("en");
  await page.evaluate(() => window.__wb.shell.open("analysis"));
  assert.ok((await page.locator("#rep-analysis-detail").innerText()).includes("Model choices before this action"));
  assert.deepEqual(await page.locator('[data-card-pile]:visible').allTextContents(), ['US hand', 'USSR hand', 'Discard pile', 'Removed from Game']);
  assert.equal(await page.locator("#rep-analysis-warning, .rep-chart-legend").count(), 0);
  assert.equal(await page.locator("#replay-analysis-panel").getByText("No rollout search.", { exact: false }).count(), 0);
  assert.equal(await page.evaluate(() => window.__wb.engine.saveJson()), original);

  // Export keeps the reconstruction inputs, not just the display snapshots.
  await page.evaluate(() => window.__wb.shell.open("settings"));
  await page.locator('.vtt-replay-settings > summary').click();
  assert.equal(await page.locator('.vtt-replay-settings button').count(), 2);
  assert.equal(await page.locator('.vtt-replay-settings #input-replay-file').count(), 1);
  const pending = page.waitForEvent("download");
  await page.locator("#btn-rep-export").click();
  const file = await pending;
  const stream = await file.createReadStream();
  let text = ""; for await (const chunk of stream) text += chunk;
  const exported = JSON.parse(text);
  assert.equal(exported.metadata.seed, 42);
  assert.equal(exported.steps[0].forced_die, 0);
  assert.ok(exported.steps[0].seat_rules);
  // Upload from Settings must take the user directly to the analysis dock.
  await page.locator('#input-replay-file').setInputFiles({
    name: 'replay.tslog.json', mimeType: 'application/json', buffer: Buffer.from(text),
  });
  await page.locator('#replay-analysis-panel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-dock-tab="analysis"]').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('[data-dock-page="settings"]').isVisible(), false);
  await page.waitForFunction(() => window.__wb.replayAnalyzer.state.phase === "complete");

  await page.evaluate(() => {
    const doc = structuredClone(window.testReplay);
    doc.steps[5].state_snapshot.victory_points += 5;
    window.__wb.replayControls.loadReplayData(doc);
  });
  await page.waitForFunction(() => window.__wb.replayAnalyzer.state.phase === "error");
  assert.equal(await page.evaluate(() => window.__wb.replayAnalyzer.state.points.length), 0);
  assert.equal(await page.evaluate(() => window.__wb.replayAnalyzer.state.error.step), 5);

  // Rapid restart + cancellation cannot leave stale points attached to a replacement replay.
  await page.evaluate(() => {
    const w = window.__wb;
    w.replayControls.loadReplayData(window.testReplay);
    w.replayAnalyzer.cancel();
    w.replayControls.loadReplayData({ steps: window.testReplay.steps });
  });
  await page.waitForFunction(() => window.__wb.replayAnalyzer.state.phase === "error");
  assert.ok((await page.locator("#rep-analysis-status").innerText()).includes("no starting seed"));
  assert.equal(await page.evaluate(() => window.__wb.engine.saveJson()), original);
  await page.evaluate(() => window.__wb.shell.open("analysis"));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  console.log("Replay browser checks passed: auto analysis, two critics, timeline, locale, export, drift, cancellation, isolation and mobile layout.");
} finally { await browser.close(); }
