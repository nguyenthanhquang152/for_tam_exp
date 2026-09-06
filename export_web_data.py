"""Export validated workbook data for the browser build; JSON goes to stdout."""

import hashlib
import json
import sys
from pathlib import Path

from plot_bacteria import BASE, GROUPS, TISSUE_NAMES, read_data, taxon_group


def export_data(path):
    records = read_data(path)
    return {
        "schemaVersion": 1,
        "source": {"filename": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()},
        "groups": [{"name": name, "color": color} for name, _, color in GROUPS],
        "tissueNames": {t: TISSUE_NAMES.get(t, t) for t in sorted({r["Tissue"] for r in records})},
        "rows": [{
            "time": r["Time"], "tissue": r["Tissue"], "taxon": r["Taxon"],
            "treatment": r["Treatment"], "total": int(r["n_shrimp"]),
            "positive": int(r["n_pos"]), "percent": r["prevalence_pct"],
            "group": taxon_group(r["Taxon"]),
        } for r in records],
    }


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "MA_56D_R_corrected.xlsx"
    json.dump(export_data(path), sys.stdout, ensure_ascii=True, allow_nan=False)
