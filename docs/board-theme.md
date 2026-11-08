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
until separate card artwork is supplied. It remains visible in all phases, including
influence placement and the opponent's turn; only legal card choices are clickable.
Manual minimization is preserved. A player sees their own hand, while developer
view follows the decision player. Extra event choices are separate from hand cards.
Developer-only undo/debug controls and
Steam icons for active effects occupy two left-edge columns. The debug editor remains a
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
`node tests/web/tabletop_hand.mjs <base-url>` checks hand visibility during actual
setup and Ops influence placement, collapse persistence, read-only tooltips,
headline choices, player privacy, event choices from other piles, the China card,
empty hands and replay read-only behavior.
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

## Steam effect icons

The approved icon set is exported from the installed game's Unity sprites, preserving
transparency. `web/ui/src/effects/steam-icons.json` records the source asset file, Sprite
path ID, dimensions and SHA-256 for 35 card icons, four space-track images and a question
icon. Forty card-effect flags map to these images by stable key; the eight possible
space perks use the four standard track images. Generic internal states use the question
icon instead of an unconfirmed card association. Buttons retain their dark shell,
side-coloured border, accessible title, tooltip and click/keyboard details.

The reviewed PNG exports live in ignored `web/ui/public/personal/effects/`. The personal
Azure workflow runs `deploy/azure/prepare-effects.py` to obtain the fork's separate
`personal-steam-effects-v1` release pack, checking the archive and every PNG's SHA-256.
Publication stops if the pack is missing or corrupt. A missing image falls back to a generic
SVG question mark without disabling the effect button. Source contributions exclude
the PNG artwork. The local review and pack live in the workspace's `reference` directory.

`node tests/web/tabletop_effects.mjs <base-url>` verifies asset hashes, all card mappings,
space-perk cancellation, keyboard details, unknown/missing-image fallbacks, narrow layout
and unchanged engine state. Screenshots are written to `scratch/tabletop-effects`.

## Space track window

The detail window uses eight original Steam sprites (`SpaceRace_01` through
`SpaceRace_08`), with provenance/hashes in `web/ui/src/space/steam-track.json`.
These are the installed game's standard set, in its original numeric order.
Local builds load the reviewed PNGs from ignored `web/ui/public/personal/space/`.
The eight panels stay on one horizontal rail; a missing PNG leaves its stage number.
Rule values still come from the engine. The image does not determine a rule or reward.

The workspace reference pack is `reference/DeepStruggle-steam-space.zip`, 37,808 bytes,
SHA-256 `094a2edebb8aa0971390053d694f42f529c3577f1b401e2512e3d2068e7a021c`.
It contains `space/*.png` for extraction into `public/personal/`. The supplemental
pack is published separately as the fork's `personal-steam-space-v1` release asset.
The Azure build runs `deploy/azure/prepare-space.py`, verifies the archive and every
PNG, and checks the packaged images and Source Han Serif font before publication.
Do not include these Steam PNGs in the MIT source patch.

## Hanon card-face previews

Card references display optional Hanon Chinese artwork. The four
reviewed 10-by-7 atlases cover standard cards 1–110: early 1–35 plus 103, mid 36–81,
late 82–102, optional 104–110. Source hashes, cell indices, exact crop rectangles
and per-file hashes are in `web/ui/src/cards/hanon-art.json`. Original pixels are
extracted at native dimensions, then encoded as WebP quality 92 (no redrawing).
The 110 individual files total 10,889,082 bytes and are loaded on demand, rather
than decoding all four large atlases in the game. Files live under the ignored
`web/ui/public/personal/cards/` directory; source-only builds fall back to text.

The reference extraction script is `reference/extract-hanon-cards.mjs` in the parent
workspace. The separate `personal-hanon-cards-v1` release contains
`DeepStruggle-hanon-cards-v1.zip`. The Azure workflow runs
`deploy/azure/prepare-cards.py`, verifying the archive and all 110 image hashes before
writing files; it checks every packaged card again before deployment. Do not commit
the images into the MIT source patch.

Log/action card references, card lists outside the hand and ongoing-effect icons
share the image preview, using the hand preview's compact size, retained on collapse.
Effects resolve through `EFFECT_INFO_MAP.cardId`; space perks retain their own
explanations. Clicked effects still show their current-state
explanations. The hand keeps a compact 320px text selector with US blue, USSR red
and neutral default names. Its separate image preview appears after 100ms of dwell,
12px to the right, bottom-aligned and 22px taller than the selector when space allows.
Moving into the image keeps it readable; rapid passes do not switch images, and the
previous image remains until the replacement loads. Narrow viewports reduce both
list and image width. Collapse, rerender and locale changes invalidate pending loads;
missing artwork falls back to localized text. Readonly visible hands remain
previewable, while hidden hands and legal-play permissions remain unchanged.
Validate with `tests/web/tabletop_hand_preview.mjs`, `tests/web/tabletop_hand.mjs`
and `tests/web/tabletop_card_art.mjs`. The earlier overlap prototype was rejected;
the accepted reference is `reference/hand-list-preview/compact.html`.
