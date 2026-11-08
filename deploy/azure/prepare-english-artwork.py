"""Fetch and verify the optional English board, counters and 110 card faces."""
import hashlib
import io
import json
import sys
from pathlib import Path, PurePosixPath
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
DEST = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "web/ui/public/personal"
URL = "https://github.com/LingAochuan/DeepStruggle/releases/download/personal-english-art-v1/DeepStruggle-english-art-v1.zip"
SHA256 = "aadc6718b9e11d79cfa4a145ca465319f98193d2ffd9c4115ebe34a8ae62e6de"
manifest = json.loads((ROOT / "web/ui/src/artwork/english-sources.json").read_text(encoding="utf-8"))
if set(manifest["cards"]) != {str(i) for i in range(1, 111)}:
    raise ValueError("Incomplete English card manifest")
entries = [manifest["board"], *manifest["counters"].values(), *manifest["cards"].values()]
assets: dict[str, str] = {entry["file"]: entry["sha256"] for entry in entries}
if len(assets) != 113:
    raise ValueError("Expected 113 distinct English artwork files")
for name in assets:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
        raise ValueError(f"Invalid artwork path: {name}")


def verified(path: Path, expected: str) -> bool:
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == expected


if not all(verified(DEST / name, sha) for name, sha in assets.items()):
    for attempt in range(3):
        try:
            with urlopen(URL, timeout=90) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != SHA256:
                raise ValueError("English artwork archive SHA-256 mismatch")
            with ZipFile(io.BytesIO(data)) as archive:
                payloads = {name: archive.read(name) for name in assets}
            for name, payload in payloads.items():
                if hashlib.sha256(payload).hexdigest() != assets[name]:
                    raise ValueError(f"English artwork SHA-256 mismatch: {name}")
            for name, payload in payloads.items():
                dest = DEST / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(payload)
            break
        except Exception:
            if attempt == 2:
                raise
print(f"English artwork ready: {len(assets)} verified files.")
