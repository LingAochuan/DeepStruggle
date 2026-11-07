"""Fetch the optional Steam space-track pack; reject missing or altered artwork."""
import hashlib
import io
import json
import sys
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
DEST = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "web/ui/public/personal/space"
URL = "https://github.com/LingAochuan/DeepStruggle/releases/download/personal-steam-space-v1/DeepStruggle-steam-space.zip"
SHA256 = "094a2edebb8aa0971390053d694f42f529c3577f1b401e2512e3d2068e7a021c"
stages = json.loads((ROOT / "web/ui/src/space/steam-track.json").read_text())["stages"]
assets = {stage["name"]: stage for stage in stages.values()}

def verified(path: Path, expected: str) -> bool:
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == expected

if not all(verified(DEST / f"{name}.png", asset["sha256"]) for name, asset in assets.items()):
    for attempt in range(3):
        try:
            with urlopen(URL, timeout=90) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != SHA256:
                raise ValueError("Space track pack SHA-256 mismatch")
            with ZipFile(io.BytesIO(data)) as archive:
                payloads = {name: archive.read(f"space/{name}.png") for name in assets}
            for name, payload in payloads.items():
                if hashlib.sha256(payload).hexdigest() != assets[name]["sha256"]:
                    raise ValueError(f"Space stage SHA-256 mismatch: {name}")
            DEST.mkdir(parents=True, exist_ok=True)
            for name, payload in payloads.items():
                (DEST / f"{name}.png").write_bytes(payload)
            break
        except Exception:
            if attempt == 2:
                raise
print(f"Steam space track ready: {len(assets)} verified original PNGs.")
