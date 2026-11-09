// Uses the built WASM and Node; no model, Python extension or external data required.
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const require = createRequire(resolve("web/ui/package.json"));
const dir = await mkdtemp(join(tmpdir(), "ts-replay-test-"));
try {
  const outfile = join(dir, "test.mjs");
  await require("esbuild").build({ entryPoints: ["tests/web/js/replay_analysis.ts"], outfile,
    bundle: true, platform: "node", format: "esm", define: { "import.meta.env.BASE_URL": '"/"' } });
  const result = spawnSync(process.execPath, [outfile, pathToFileURL(resolve("web/ui/public") + "/").href], { stdio: "inherit" });
  if (result.status !== 0) process.exitCode = result.status || 1;
} finally { await rm(dir, { recursive: true, force: true }); }
