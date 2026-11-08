"""Fetch the optional Hanon card pack; verify the archive and every card before writing."""
import hashlib
import io
import json
import sys
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
DEST = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "web/ui/public/personal/cards"
URL = "https://github.com/LingAochuan/DeepStruggle/releases/download/personal-hanon-cards-v1/DeepStruggle-hanon-cards-v1.zip"
SHA256 = "2936c289165eae96d727f9683db2474bba0a68af5403d7609ecb90375bfedaf5"
cards = json.loads((ROOT / "web/ui/src/cards/hanon-art.json").read_text(encoding="utf-8"))["cards"]
assert set(cards) == {str(i) for i in range(1, 111)}, "Incomplete card manifest"
assets = {card["file"]: card["sha256"] for card in cards.values()}
assert len(assets) == 110 and all(Path(name).name == name for name in assets)


def verified(path: Path, expected: str) -> bool:
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == expected


if not all(verified(DEST / name, sha) for name, sha in assets.items()):
    for attempt in range(3):
        try:
            with urlopen(URL, timeout=90) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != SHA256:
                raise ValueError("Hanon card pack SHA-256 mismatch")
            with ZipFile(io.BytesIO(data)) as archive:
                payloads = {name: archive.read(f"cards/{name}") for name in assets}
            for name, payload in payloads.items():
                if hashlib.sha256(payload).hexdigest() != assets[name]:
                    raise ValueError(f"Card SHA-256 mismatch: {name}")
            DEST.mkdir(parents=True, exist_ok=True)
            for name, payload in payloads.items():
                (DEST / name).write_bytes(payload)
            break
        except Exception:
            if attempt == 2:
                raise
print(f"Hanon cards ready: {len(assets)} verified WebP images.")
