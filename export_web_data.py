"""Export validated workbook data for the browser build; JSON goes to stdout."""

import hashlib
import json
import sys
from pathlib import Path

from bacteria_data import BASE, GROUPS, TISSUE_NAMES, read_data, taxon_group
from standardize_day42 import standardize_day42

DEFAULT_SOURCES = ("MA_D14_R.xlsx", "MA_28D_R.xlsx", "MA_42D.xlsx", "MA_56D_R_corrected.xlsx")


def load_sources(paths):
    records, sources, seen_times = [], [], set()
    for path in map(Path, paths):
        metadata = {"filename": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        input_path = path
        if path.name == "MA_42D.xlsx":
            input_path = BASE / "standardized/MA_42D_standardized.xlsx"
            metadata["normalization"] = standardize_day42(path, input_path)
            metadata["standardizedFilename"] = str(input_path.relative_to(BASE))
        rows = read_data(input_path)
        times = {r["Time"] for r in rows}
        if len(times) != 1 or times & seen_times:
            raise ValueError("Each source must contain one distinct sampling time.")
        metadata["time"] = next(iter(times))
        seen_times.update(times)
        sources.append(metadata)
        records.extend(rows)
    return records, sources


def export_data(paths):
    records, sources = load_sources(paths)
    return {
        "schemaVersion": 2,
        "sources": sources,
        "groups": [{"name": name, "color": color} for name, _, color in GROUPS],
        "tissueNames": {t: TISSUE_NAMES.get(t, t) for t in sorted({r["Tissue"] for r in records})},
        "rows": [{
            "time": r["Time"], "tissue": r["Tissue"], "taxon": r["Taxon"],
            "treatment": r["Treatment"], "total": int(r["n_shrimp"]),
            "positive": None if r["n_pos"] is None else int(r["n_pos"]), "percent": r["prevalence_pct"],
            "missing": int(r["n_missing"]), "observedPositive": int(r["n_pos_observed"]),
            "group": taxon_group(r["Taxon"]),
        } for r in records],
    }


if __name__ == "__main__":
    paths = sys.argv[1:] or [BASE / name for name in DEFAULT_SOURCES]
    json.dump(export_data(paths), sys.stdout, ensure_ascii=True, allow_nan=False)
