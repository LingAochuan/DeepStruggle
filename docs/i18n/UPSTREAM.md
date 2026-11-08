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
  84 country names, regions and shared terminology. Card names now follow the user's
  2026-11-08 decision to match the Hanon Chinese artwork, documented by ID in
  `docs/i18n/hanon-card-names.json` (75 unchanged names, 34 wording changes, one
  punctuation change). Original review names remain in that comparison record.
  Event descriptions were translated from this project's English metadata; only
  their card-name references change, not the rules text or engine behavior.
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

The standalone Node test uses esbuild from `web/ui/node_modules`; it does not need
the native engine. It checks complete card/country coverage, reviewed names,
cross-references, message parameters, English fallback and locale persistence.
Browser validation should additionally cover switching during a game, both play
and replay views, localized tooltips/logs, the leaderboard and narrow screens.

### Validation of the initial patch (2026-11-07)

- TypeScript checking and Vite production build passed.
- `node tests/web/i18n.mjs` passed, including multiple-card log references.
- Existing English golden-log runner: 1,529 steps, zero mismatches. Existing
  card-reference assertions and rollout-spec runner also passed under Node.
- Chromium checks passed for English default, Chinese selection, a legal move,
  language round trips preserving the position/history/saved record, open-modal
  redraw, all 110 cards, preference persistence, leaderboard and 375px layout.
- The unchanged WASM engine passed its ten-game self-test. This Windows environment
  used the existing CI-built WASM artifact, verified against the source fingerprint;
  it did not rebuild the engine with Emscripten.
- The complete `tests/web` pytest suite could not collect here because native
  `ts_engine` and other Python/browser dependencies were unavailable. It still
  needs to run in the project's configured build environment before merging.

## Applying the source patch

The exported patch is scoped to the optional locale implementation, its tests and
developer documentation. Apply it in a clean checkout based on the recorded base:

Upstream base: `f383abd28cfc57c3cb60442d3a388ace90e0a063`.
The export was prepared from fork commit `5f1fecf91547a10e6b02be3f30f83ab9bab014ee`;
fork-specific deployment changes are excluded.

```sh
git apply --check deepstruggle-zh-CN.patch
git apply deepstruggle-zh-CN.patch
```

For an upstream contribution, put these changes on a dedicated branch and open a
pull request against `mihaild/DeepStruggle`. Review-page exports and Azure-specific
deployment files are not part of this patch. Changes made upstream since the base
may require rebasing and resolving conflicts before applying the patch.
