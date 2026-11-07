# Personal tabletop and classic board

The optional Hanon board uses one SVG image and 84 interactive SVG overlays in the
same coordinate system. Pan, pinch and wheel zoom therefore move
the artwork and hit areas together. The rule metadata, country IDs and engine are
unchanged. The original diagram is still available from the map-style selector.

Place the personal artwork at `web/ui/public/personal/hanon-board.jpg`. This folder
is git-ignored and is not part of a source contribution. Without it, the page falls
back to the diagram. The selected style is saved as `deepstruggle.map-style.v1`.
The image is a Chinese board; switching interface languages does not translate
text embedded in its pixels. Card artwork is outside this change.

The personal Azure workflow prepares this optional pack using
`node deploy/azure/prepare-artwork.mjs` before Vite builds. The script verifies the
board and all counters against the recorded SHA-256 hashes. See the
[deployment guide](../deploy/azure/README.md).

## Registration

Source: Hanon's Workshop item 2793711137, table image UGC
1848173365184640946/F3465B72EC0E8DFFAD3F6DF08AA722234C3251EE, 9182 by 5940 pixels.

`web/ui/src/board/hanon-layout.json` records country rectangles in a 1000-unit-wide
image space with the original aspect ratio. The TTS USA/USSR marker pairs provide
country names and initial centres. `Dominican Republic` maps to `Dominican Rep`;
every other name matches directly. An affine fit to detected printed rectangles
initializes the positions. Local dark-border searches refine left/right/bottom
edges; the 240-pixel box height includes the printed name band. All 84 bottom-edge
confidence values exceed 0.94. Calibration intermediates remain in the local
reference folder. No TTS Lua scripts are executed or incorporated into the engine.

Use the registration control in Settings to show target borders and engine IDs,
then pan and zoom to inspect alignment. Keep the printed country name bands visible; only
dynamic influence markers, control tints and action outlines cover the artwork.
Compact region headings open the engine's existing live scoring summaries.
`board/track-layout.json` registers all printed track cells, including the irregular
VP grid (-20 through +20). `board/tracks.ts` renders turn/era, action round/phase,
DEFCON, both space and military counters, VP and a military-requirement outline
from the current viewed snapshot. Shared cells offset US/USSR counters diagonally.
Setup/headline/game-over phases have no misleading action-round counter; the current-action panel describes the phase. Clicking the space track opens its existing rules dialog. The schematic
fallback shows its numbers in an SVG footer; neither style mounts the old header.
The printed Chinese Civil War box is not an extra country or actionable target.

## Tabletop shell

The map fills the viewport. Four right-edge tools select log, analysis, model
configuration (with a compact leaderboard) and settings; clicking the selected tool again closes it. The
current action sits below the selected panel while expanded, and floats at the
bottom right while collapsed. A bottom-left text selector keeps card play usable
until separate card artwork is supplied. Developer-only undo/debug controls and
numbered active effects occupy two left-edge columns. The debug editor remains a
dialog. Settings house language, player/developer view, replay, analysis visibility,
map style, registration and new-game controls. There are no zoom or region buttons.
`fvtt_shell.ts` manages panel state and `fvtt_shell.css` supplies the dark translucent
shell; game actions still go through the existing session/engine APIs.

## Validation

`node tests/web/board_layout.mjs` checks all IDs, image aspect, rectangle bounds and
overlap, plus all 79 printed track cells and their separation from country targets.
Run `node tests/web/i18n.mjs` and the frontend production build too.
With Vite or a production preview running, `node tests/web/tabletop_ui.mjs <base-url>`
checks the actual browser shell, legal setup/headline choices, undo/debug, player
redaction, model-form relocation, replay file loading/scrubbing, effects and track
rendering. It uses Playwright (`PLAYWRIGHT_MODULE` optionally names a module URL,
`BROWSER_EXECUTABLE_PATH` an existing Chromium) and writes screenshots under
`scratch/tabletop-check` (`TABLETOP_ARTIFACTS` can override). Model downloads are
disabled for this UI check; it does not benchmark or validate inference.
`node tests/web/tabletop_feedback.mjs <base-url>` additionally checks the independent
panel minimizers, single action scrollbar, batch debug form, non-overlapping card
probabilities, HUD hover references and bilingual play-mode labels. It uses the
same Playwright environment variables.
Browser checks must cover actual country selection after zoom/pan, hover, mobile
tap, undo, language/style switches retaining a game, and missing-artwork fallback.
Run the repository's full `tests/web` suite in its configured native-engine build
environment; local Windows collection lacks those dependencies.

The current-action and text-card panels independently minimize to a plus button.
Only the action body scrolls; its target list has no nested scrollbar. Text cards
reserve separate columns for Ops and probability badges. HUD card mentions share
the log tooltip using display-only card references. The debug inspector has one
bottom Apply button: only edited fields are submitted, country values start from
the viewed position, and drafts survive country/language changes. Existing debug
events and per-edit undo records remain unchanged.

The optional counter pack (`public/personal/counters/`, ignored by git) uses the
original Hanon TTS textures. `board/counter-sources.json` records URLs and hashes;
`counter-art.ts` clips the mesh face UVs directly in SVG without rewriting images.
Classic influence counters fill their printed half-cells and retain control faces
and numeric overlays. Track counters match printed cells (20–30 SVG units); two
sides in one cell are offset diagonally. Missing textures leave vector fallbacks.
The redundant classic-board phase caption is removed; the schematic keeps its
footer. Country probabilities sit below full-size counters, with no pointer hit area.
Transient dice results, dice input, analysis/result dialogs and the leaderboard
use the same neutral tabletop palette; side colours still identify US/USSR.
Minimized panels use a full-inset button and a panel-level click fallback so the
entire square opens the panel, including its border/padding.

With the optional counter pack installed, `node tests/web/tabletop_art.mjs <base-url>`
checks texture loading, marker sizes, dice styling, all 32 panel-corner combinations
(two panels, docked/floating, desktop/narrow viewport), missing-counter fallback,
and the main panels' palette. Screenshots are written to `scratch/tabletop-art`.
