"""Export validated workbook data for the browser build; JSON goes to stdout."""

import hashlib
import json
import sys
from pathlib import Path

from bacteria_data import DEFAULT_SOURCES, RAW_DIR, STANDARDIZED_DIR, GROUPS, TISSUE_NAMES, read_data, taxon_group
from standardize_data import standardize_source


def load_sources(paths):
    records, sources, seen_times = [], [], set()
    for path in map(Path, paths):
        report = standardize_source(path)
        input_path = STANDARDIZED_DIR / f"{path.stem}_standardized.xlsx"
        metadata = {"filename": path.name, "sha256": report["sha256"], "rawPath": report["rawPath"],
                    "normalization": report, "standardizedFilename": report["standardizedPath"],
                    "standardizedSha256": report["standardizedSha256"]}
        if hashlib.sha256(input_path.read_bytes()).hexdigest() != report["standardizedSha256"]:
            raise ValueError("Standardized source changed before loading.")
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
    paths = sys.argv[1:] or [RAW_DIR / name for name in DEFAULT_SOURCES]
    json.dump(export_data(paths), sys.stdout, ensure_ascii=True, allow_nan=False)
