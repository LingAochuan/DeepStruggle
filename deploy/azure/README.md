# Personal Azure Static Web Apps deployment

Deployment target: [DeepStruggle](https://polite-ocean-092aa1a00.6.azurestaticapps.net/).

This deploys the browser game to a dedicated Azure Static Web App. GitHub Actions builds
the C++ engine as WebAssembly and bundles the TypeScript page. The browser runs the rules
and ONNX inference. No VM, SSH key, Python web server, CUDA or training dependencies are needed.

The existing PCOL project uses this Azure service too. It is separate from an Azure Linux VM.
Create a separate app for DeepStruggle: reusing PCOL's deployment token would overwrite PCOL.

## Configure once

1. Use the fork `LingAochuan/DeepStruggle`. `origin` points to the fork; `upstream` points to
   `mihaild/DeepStruggle`. Keep `main` aligned with upstream and personal changes on `personal`.
   Retain the MIT license. Start contributions from upstream `main` on separate feature branches.
2. Enable Actions for the fork. Pushes to `personal` run this workflow and build an artifact.
   Upstream workflows targeting `main` do not run on these pushes. Leave upstream scheduled,
   research and training workflows disabled unless needed. Optionally make `personal` the
   fork's default branch to expose this workflow's **Run workflow** button: GitHub only offers
   manual dispatch for workflows present on the default branch.
3. Create a dedicated Azure **Static Web App**, choosing the Free plan if its quotas fit.
   Use the deployment-token setup with an **Other** deployment source where available;
   this repository supplies its own build workflow rather than Azure's generated one.
4. Copy that app's deployment token directly into GitHub Settings > Secrets and variables >
   Actions as `AZURE_STATIC_WEB_APPS_API_TOKEN`. Alternatively, store it in the GitHub
   environment `azure-static-web-apps`. Do not put its value into code or chat.
5. First verify a successful **Build and deploy personal Azure site** run on `personal`.
   It produces `deepstruggle-static-site`; deployment is skipped by default.
6. To deploy on subsequent pushes, add the repository Actions variable
   `AZURE_STATIC_WEB_APPS_DEPLOY_ENABLED` with value `true`, then push to `personal`.
   Alternatively, if manual dispatch is available, run on `personal` with `deploy` checked.
   Azure's production branch is explicitly `personal`. Open the dedicated Static Web App URL
   and verify the board, a playable game and model loading in the browser.

The build includes TypeScript checking and a ten-game WebAssembly self-test. This verifies
that the packaged engine loads and steps; it does not replace browser E2E or rules parity tests.
Artifacts expire after seven days. Deployment runs after the build succeeds, and no build
dependencies are installed on the Azure VM.

The personal workflow runs `node deploy/azure/prepare-artwork.mjs` before bundling.
It downloads the Hanon board and ten counter textures from Steam's CDN, verifying
every file against `web/ui/src/board/counter-sources.json`. A failed download or
changed hash stops the deployment. Artwork stays in the ignored `public/personal/`
directory and in the deployed site; it is not committed to the source repository.
Source-only builds retain the schematic fallback. The script also accepts an
output directory as its first argument for testing a fresh download.

The optional 110 Hanon card faces are fetched by `prepare-cards.py` from the separate
`personal-hanon-cards-v1` release. The 10.9 MB archive and every WebP are SHA-256
verified against `web/ui/src/cards/hanon-art.json`; the build checks all 110 packaged
images again before upload. Card artwork remains outside the MIT source patch.

The workflow caches `web/ui/public/personal` with a key derived from the four source
manifests and preparation scripts. All preparation scripts still run and verify
cached bytes. Failed preparation retries up to four times, waiting 15, 30 and 45
seconds between attempts, in addition to each script's own download attempts.
Exhausting retries or a persistent hash mismatch stops the build before deployment;
the existing Azure site remains in place. Compilation is a separate step, so a
compiler error is not retried as a download error. A cache miss needs the source
servers to be reachable; the cache is not a replacement for those sources.

## Models, storage and persistence

- Models continue to use the upstream Hugging Face catalogue or a locally imported compatible
  `.onnx` file. This workflow does not bundle model weights, so remote model loading still
  requires access to Hugging Face. Local model hosting can be added separately.
- Azure Free currently allows 250 MB per environment and 15,000 files. The workflow checks
  those limits before uploading; future card artwork or bundled models must fit that budget.
- Saves remain in browser storage and exported files; Azure hosting does not add cross-device
  saves. The optional upstream game-statistics endpoint is left unset.
- This configuration does not restrict visitor access. Solo play and a private-access website
  are separate requirements; add Azure role-based access if restricted access is wanted.

References: [build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration),
[site configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration),
[quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas).
