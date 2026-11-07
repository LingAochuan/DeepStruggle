# Personal Azure Static Web Apps deployment

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
