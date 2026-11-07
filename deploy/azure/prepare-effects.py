"""Fetch the optional personal-site Steam art pack, verifying every original byte."""
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "web/ui/public/personal/effects"
URL = "https://github.com/LingAochuan/DeepStruggle/releases/download/personal-steam-effects-v1/DeepStruggle-steam-effects.zip"
SHA256 = "a76036408b3974452e34cb96631b2a3cf298e01d500628ec3fb2e27973524039"
assets = json.loads((ROOT / "web/ui/src/effects/steam-icons.json").read_text())["assets"]

def verified(path, expected):
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == expected

if not all(verified(DEST / f"{name}.png", asset["sha256"]) for name, asset in assets.items()):
    for attempt in range(3):
        try:
            with urlopen(URL, timeout=90) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != SHA256:
                raise ValueError("Effect pack SHA-256 mismatch")
            with ZipFile(io.BytesIO(data)) as archive:
                # Read only the manifest's filenames; never extract arbitrary archive paths.
                payloads = {name: archive.read(f"effects/{name}.png") for name in assets}
            for name, payload in payloads.items():
                if hashlib.sha256(payload).hexdigest() != assets[name]["sha256"]:
                    raise ValueError(f"Effect icon SHA-256 mismatch: {name}")
            DEST.mkdir(parents=True, exist_ok=True)
            for name, payload in payloads.items():
                (DEST / f"{name}.png").write_bytes(payload)
            break
        except Exception:
            if attempt == 2:
                raise
print(f"Steam effects ready: {len(assets)} verified original PNGs.")
