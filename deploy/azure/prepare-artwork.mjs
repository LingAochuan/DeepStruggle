// Optional personal-site pack. Upstream/source-only builds do not run this script.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(process.argv[2] || resolve(root, 'web/ui/public/personal'));
const manifest = JSON.parse(await readFile(resolve(root, 'web/ui/src/board/counter-sources.json'), 'utf8'));
const entries = [['hanon-board.jpg', manifest.board], ...Object.entries(manifest.assets).map(([name, asset]) => [`counters/${name}.png`, asset])];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

for (const [name, asset] of entries) {
  const dest = resolve(output, name);
  const cached = await readFile(dest).catch(() => null);
  if (cached && hash(cached) === asset.sha256) {
    console.log(`Verified ${name} (${cached.length} bytes)`);
    continue;
  }
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = new URL(asset.source);
      // Both official Steam CDN hosts serve the same original UGC bytes.
      url.protocol = 'https:';
      url.hostname = attempt === 1 ? 'steamusercontent-a.akamaihd.net' : 'images.steamusercontent.com';
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (hash(bytes) !== asset.sha256) throw new Error(`SHA-256 mismatch for ${name}`);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, bytes);
      console.log(`Fetched and verified ${name} (${bytes.length} bytes)`);
      failure = null;
      break;
    } catch (error) {
      failure = error;
      console.warn(`Attempt ${attempt + 1} for ${name}: ${error.message}`);
    }
  }
  if (failure) throw new Error(`Personal artwork unavailable: ${name}`, { cause: failure });
}
console.log(`Personal artwork ready: ${entries.length} verified files.`);
