// No native engine needed: node tests/web/i18n.mjs (after cd web/ui && npm ci).
// The browser integration is additionally checked against the actual WASM workbench.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(root, "web/ui/package.json"));
const { build } = require("esbuild");
const temporary = await mkdtemp(join(tmpdir(), "deepstruggle-i18n-"));
try {
  const bundle = join(temporary, "i18n.mjs");
  await build({ stdin: { contents: `export * from ${JSON.stringify(join(root, "web/ui/src/i18n/index.ts"))}; export * from ${JSON.stringify(join(root, "web/ui/src/i18n/log.ts"))};`, resolveDir: root }, outfile: bundle,
    bundle: true, platform: "node", format: "esm", logLevel: "silent" });
  const storage = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value),
  } });
  globalThis.document = { documentElement: { lang: "en" }, querySelectorAll: () => [], getElementById: () => null };
  globalThis.location = { href: "http://localhost/?position=keep-this", search: "?position=keep-this" };
  globalThis.history = { state: { session: 17 }, replaceState(state, _title, value) {
    assert.deepEqual(state, { session: 17 });
    globalThis.location.href = String(value);
    globalThis.location.search = new URL(value).search;
  } };
  const i18n = await import(pathToFileURL(bundle));
  const cards = JSON.parse(await readFile(join(root, "rules/cards.json"), "utf8"));
  const countries = JSON.parse(await readFile(join(root, "rules/map.json"), "utf8")).countries;
  const zh = JSON.parse(await readFile(join(root, "web/ui/src/i18n/zh-CN/game.json"), "utf8"));
  const messages = JSON.parse(await readFile(join(root, "web/ui/src/i18n/zh-CN/messages.json"), "utf8"));
  const logMessages = JSON.parse(await readFile(join(root, "web/ui/src/i18n/zh-CN/log-messages.json"), "utf8"));
  assert.equal(i18n.locale(), "en", "English must remain the default");
  for (const c of cards) {
    assert.equal(i18n.cardName(c.id, c.name), c.name);
    assert.equal(i18n.cardDescription(c.id, c.description), c.description);
  }
  let notifications = 0;
  const unsubscribe = i18n.onLocaleChange(() => notifications++);
  i18n.setLocale("zh-CN");
  assert.equal(globalThis.document.documentElement.lang, "zh-CN");
  assert.equal(new URL(globalThis.location.href).searchParams.get("position"), "keep-this");
  assert.equal(new URL(globalThis.location.href).searchParams.get("lang"), "zh-CN");
  assert.equal(storage.get("deepstruggle.locale.v1"), "zh-CN");
  assert.equal(notifications, 1);
  i18n.setLocale("zh-CN");
  assert.equal(notifications, 1, "Unchanged locale must not cause redundant redraws");
  assert.deepEqual(Object.keys(zh.cards).map(Number).sort((a,b)=>a-b), cards.map(c=>c.id));
  assert.equal(Object.keys(zh.countries).length, 84);
  for (const c of cards) {
    assert.match(i18n.cardName(c.id, c.name), /[\u3400-\u9fff]/);
    const description = i18n.cardDescription(c.id, c.description);
    assert.match(description, /[\u3400-\u9fff]/);
    assert(!description.includes("[#"), "No unresolved card-name placeholders");
    for (const match of description.matchAll(/《([^》]+)》（#(\d+)）/g)) {
      assert.equal(match[1], zh.cards[match[2]].name, "Cross-references must use the approved card name");
    }
  }
  for (const c of countries) assert.equal(i18n.countryName(c.id, c.name), zh.countries[String(c.id)]);
  const adoptedNames = JSON.parse(await readFile(join(root, "docs/i18n/hanon-card-names.json"), "utf8"));
  assert.deepEqual(adoptedNames.entries.map(c => c.id), cards.map(c => c.id));
  for (const c of adoptedNames.entries) assert.equal(i18n.cardName(c.id, c.en), c.hanonZh, "Card names follow the adopted Hanon artwork");
  assert.equal(i18n.cardName(4, "Duck and Cover"), "卧倒并掩护");
  assert.equal(i18n.cardName(42, "Quagmire"), "泥潭");
  assert.equal(i18n.cardName(59, "Flower Power"), "花朵力量");
  assert.equal(i18n.term("Operations / Ops"), "行动点数");
  assert.equal(i18n.cardName(999, "Unknown card"), "Unknown card");
  assert.equal(i18n.countryName(999, "Unknown country"), "Unknown country");
  assert.equal(i18n.t("Uncatalogued message {0}", [17]), "Uncatalogued message 17");
  assert.equal(i18n.localizeLog("A new, unrecognized log format (17)"), "A new, unrecognized log format (17)");
  const start = i18n.localizeLog("Game started (Seed: 123). USSR setup: Place 6 Influence in Eastern Europe.");
  assert.match(start, /123/);
  assert.match(start, /6/);
  assert.match(start, /苏联/);
  assert(!start.includes("USSR setup"));
  const play = i18n.localizeLog("US plays Card: Duck and Cover (#4)");
  assert.match(play, /卧倒并掩护/);
  assert.match(play, /#4/);
  for (const mode of ["Influence", "Coup", "Realignment"]) {
    const unMode = i18n.localizeLog(`Event, then Ops: ${mode}`);
    assert(!/[A-Za-z]{3}/.test(unMode), `UN Intervention combined mode: ${unMode}`);
  }
  const unCard = i18n.localizeLog("  • US/Japan Mutual Defense Pact (#27) discarded");
  assert.match(unCard, /美日共同防卫协定/);
  assert.match(unCard, /已弃置/);
  assert(!/[A-Za-z]{3}/.test(unCard));
  const headline = i18n.localizeLog("  ★ Headlines Simultaneously Revealed: US plays 'Duck and Cover' (#4, 3 Ops) vs USSR plays 'Fidel' (#8, 2 Ops)");
  assert.match(headline, /卧倒并掩护/);
  assert.match(headline, /#4/);
  assert.match(headline, /#8/);
  for (const cards of ["Duck and Cover (#4), Fidel (#8)", "Duck and Cover (#4, 3 Ops), Fidel (#8, 2 Ops)"]) {
    const deal = i18n.localizeLog(`  • US draws 2 cards: ${cards}`);
    assert.match(deal, /卧倒并掩护/);
    assert.match(deal, /菲德尔·卡斯特罗/);
    assert.deepEqual(deal.match(/#\d+/g), ["#4", "#8"], "A numbered card list must not collapse to its last card");
  }
  for (const line of [
    "  • Israel Influence: US: 1 -> 0 (-1), USSR: 0 -> 1 (+1)",
    "  • Victory Points: 0 (Tie) -> -2 (USSR) (-2 VP)",
    "  • Card #13 (Arab-Israeli War) moved: HAND_USSR_UNKNOWN -> DISCARD_PILE",
  ]) {
    const rendered = i18n.localizeLog(line);
    assert(!/[A-Za-z]{3}/.test(rendered), `Untranslated fragment: ${rendered}`);
    assert.deepEqual(rendered.match(/[+-]?\d+/g), line.match(/[+-]?\d+/g), "Log numbers must remain intact");
    assert.equal((rendered.match(/[（(]/g)||[]).length, (rendered.match(/[）)]/g)||[]).length, "Log fragments must not consume another fragment's closing parenthesis");
  }
  const slots = s => [...new Set([...s.matchAll(/\{(\d+)\}/g)].map(m=>m[1]))].sort();
  // These parameters contain only English plural suffixes or was/were. Chinese
  // omits them; numeric/content parameters must still be present.
  const grammatical = new Map([
    ["its top {0} move{1}, each played out in ", ["1"]],
    ["{0} controls with +{1} ({2} Op{3})", ["3"]],
    ["{0} of yours {1} made in the Developer view, which shows the model's hand.", ["1"]],
    ["{0} of yours {1} made with the model's analysis on screen.", ["1"]],
    ["{0} sampled world{1}", ["1"]],
    ["{0} {1} forced.", ["1"]],
    ["••• {0} entr{1} skipped •••", ["1"]],
    ["  • {0} draws {1} card{2}: {3}", ["2"]],
  ]);
  for (const [english, chinese] of Object.entries({ ...messages, ...logMessages })) {
    assert.equal(typeof chinese, "string");
    assert(chinese.trim(), `Empty translation: ${english}`);
    const optional = grammatical.get(english) ?? [];
    assert.deepEqual(slots(chinese).filter(p=>!optional.includes(p)), slots(english).filter(p=>!optional.includes(p)), `Parameters lost or invented: ${english}`);
  }
  // A blocked localStorage must not prevent switching or alter the English fallback.
  globalThis.localStorage.setItem = () => { throw new Error("Storage disabled"); };
  i18n.setLocale("en");
  assert.equal(i18n.cardName(4, "Duck and Cover"), "Duck and Cover");
  assert.equal(i18n.t("Unknown {0}", ["USSR"]), "Unknown USSR");
  assert.equal(i18n.localizeLog("US plays Card: Duck and Cover (#4)"), "US plays Card: Duck and Cover (#4)");
  assert.equal(notifications, 2);
  unsubscribe();
  i18n.setLocale("zh-CN");
  assert.equal(notifications, 2);
  // A URL language explicitly overrides the stored preference on a fresh module load.
  globalThis.location.search = "?lang=en";
  const fresh = await import(pathToFileURL(bundle).href + "?fresh");
  assert.equal(fresh.locale(), "en");
  console.log(`i18n checks passed: 110 cards, 84 countries, ${Object.keys(messages).length} messages; English fallback, reviewed names, parameters, preference and URL preservation.`);
} finally {
  assert(resolve(temporary).startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/") + "deepstruggle-i18n-"));
  await rm(temporary, { recursive: true, force: true });
}
