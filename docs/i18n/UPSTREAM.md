# Optional Simplified Chinese UI

This change adds an optional `zh-CN` display language to the web workbench and the
leaderboard. English remains the default. The language selector and `?lang=zh-CN`
choose Chinese; a browser preference remembers the selection. Changing languages
redraws the interface without starting a new game or modifying the current position.

## Scope and design

- `web/ui/src/i18n/index.ts` owns locale selection, English fallback, parameterized
  messages and display-name helpers. Translation calls are explicit; static markup
  opts in with `data-i18n` attributes.
- `web/ui/src/i18n/zh-CN/game.json` contains all 110 card names and event descriptions,
  84 country names, regions and shared terminology. Card names follow the reviewed
  glossary; event descriptions were translated from this project's English metadata.
- `web/ui/src/i18n/zh-CN/messages.json` contains interface messages. English source
  text is the key; numbered placeholders allow Chinese word order without changing
  values. Missing keys fall back to English.
- Rule metadata, WASM names and enums, replay records, URL position tokens, model
  identifiers and saved-game schemas retain their existing values. Presentation
  code localizes names by ID and translates logs after grouping/redaction.

No Steam patch binaries, fonts or images are required. The runtime is independent
of the local research files and does not import the review pages or glossary.

## Verification

Use the project's normal setup first, then:

```sh
tools/scripts/build_web.sh
node tests/web/i18n.mjs
python -m pytest -q tests/web
```

With the production build served locally (for example `npm --prefix web/ui run
preview -- --host 127.0.0.1`), the standalone browser regression can also be run:

```sh
node tests/web/i18n_browser.mjs http://127.0.0.1:4173
```

It needs Playwright and Chromium. `PLAYWRIGHT_MODULE` may name the installed
Playwright module and `BROWSER_EXECUTABLE_PATH` may name an existing Chromium.
The preview needs the matching WASM engine and `leaderboard.json`, normally made
by `build_web.sh`. The test disables model downloads and checks language changes
during play, undo, modal inputs, player privacy, reload, replay, card tooltips and
play modes, language persistence, a narrow screen, and the leaderboard. It does
not replace the native/WASM parity or model-inference tests in the Python suite.

The `web` GitHub Actions workflow runs both localization checks alongside the
complete Python Web suite, on pull requests or via `workflow_dispatch`. Its browser
check reuses the JS driver and Chromium installed by Python Playwright.

The standalone Node test uses esbuild from `web/ui/node_modules`; it does not need
the native engine. It checks complete card/country coverage, reviewed names,
cross-references, message parameters, English fallback and locale persistence.
Browser validation should additionally cover switching during a game, both play
and replay views, localized tooltips/logs, the leaderboard and narrow screens.
