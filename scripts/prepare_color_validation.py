"""Independent SciPy reference for fixed-neuron RGB cable projection."""
import hashlib
import json
from pathlib import Path

import numpy as np
import scipy.sparse as sp

root = Path(__file__).resolve().parents[1]
directory = root / "public/data/full-brain-783"
meta = json.loads((directory / "whole-arbor-1280.json").read_text())
h = sp.load_npz(root / ".cache/full-brain/whole-arbor-1280.npz")
assert h.shape == (1280 * 960, 139255)
hashed = ((np.arange(139255, dtype=np.uint64) + 1) * 2654435761) & 0xffffffff
channel = hashed % 3
values = (hashed / 4294967296).astype(np.float32)
reference = np.zeros((h.shape[0], 4), dtype=np.float32)
support = np.zeros(h.shape[0], dtype=bool)
counts = []
for c in range(3):
    selected = (channel == c).astype(np.float32)
    counts.append(int(selected.sum()))
    density = h @ selected
    light = h @ (selected * values)
    np.divide(light, density, out=reference[:, c], where=density > 0)
    support |= density > 0
reference[:, 3] = support
reference[~support, :3] = -1
raw = reference.astype("<f4").tobytes()
(directory / "validation-rgb-1280.bin").write_bytes(raw)
record = dict(scope="Synthetic activity reference, not neural or video output",
              resolution=[1280, 960], neurons=139255, channels=counts,
              format="interleaved RGBA float32 little-endian; alpha is anatomical support",
              sha256=hashlib.sha256(raw).hexdigest(), operatorSha256=meta["operatorSha256"],
              sourceAnatomySha256=meta["sourceAnatomySha256"])
(directory / "validation-rgb-1280.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record, indent=2))
