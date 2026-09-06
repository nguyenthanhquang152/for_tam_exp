"""Check release lineage and artifact agreement without assuming a fixed corpus."""

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import sys

from shrimp_microbiota.data import read_data, taxon_group


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_path(root, value, directory):
    require(isinstance(value, str) and value, f"Missing {directory} path")
    path = (root / value).resolve()
    require(path.is_relative_to(root / directory), f"Source path escapes {directory}/: {value}")
    return path


def key(row):
    return tuple(row[name] for name in ("time", "tissue", "treatment", "taxon"))


def audit(root, expected_order=None, baseline=None):
    root = Path(root).resolve()
    data = json.loads((root / "dist/data.json").read_text())
    require(data.get("schemaVersion") == 2, "Update the auditor for the actual dataset schema before relying on it")
    sources, rows = data["sources"], data["rows"]
    require(bool(sources) and bool(rows), "Empty release")
    times = [source["time"] for source in sources]
    require(len(times) == len(set(times)), "Duplicate sampling sources")
    if expected_order is not None:
        require(times == expected_order, f"Sampling order mismatch: {times}")
    indexed = {key(row): row for row in rows}
    require(len(indexed) == len(rows), "Duplicate JSON observations")
    compared = set()
    for source in sources:
        raw = source_path(root, source["rawPath"], "raw")
        normalized = source_path(root, source["standardizedFilename"], "standardized")
        require(raw.name == source["filename"], "Raw filename/provenance mismatch")
        require(digest(raw) == source["sha256"], f"Raw fingerprint mismatch: {raw.name}")
        require(digest(normalized) == source["standardizedSha256"], f"Standardized fingerprint mismatch: {normalized.name}")
        report = json.loads(normalized.with_suffix(".report.json").read_text())
        require(report == source["normalization"], f"Stale normalization report: {raw.name}")
        require(report["sha256"] == source["sha256"] and report["standardizedSha256"] == source["standardizedSha256"], "Report fingerprint mismatch")
        canonical = read_data(normalized)
        require(report["summaryRows"] == len(canonical), "Report row count mismatch")
        require(report["incompleteSummaries"] == sum(row["n_missing"] > 0 for row in canonical), "Report incomplete count mismatch")
        require(report["missingMeasurements"] == sum(row["n_missing"] for row in canonical), "Report missing count mismatch")
        for row in canonical:
            require(row["Time"] == source["time"] == report["time"], "Source time mismatch")
            ident = (row["Time"], row["Tissue"], row["Treatment"], row["Taxon"])
            require(ident in indexed and ident not in compared, f"Missing or duplicate source-backed observation: {ident}")
            expected = {"time": row["Time"], "tissue": row["Tissue"], "treatment": row["Treatment"],
                        "taxon": row["Taxon"], "total": row["n_shrimp"], "positive": row["n_pos"],
                        "percent": row["prevalence_pct"], "missing": row["n_missing"],
                        "observedPositive": row["n_pos_observed"], "group": taxon_group(row["Taxon"])}
            require(indexed[ident] == expected, f"JSON differs from standardized source: {ident}")
            compared.add(ident)
    require(compared == set(indexed), "JSON has observations with no standardized source")

    csv_seen = set()
    with (root / "reports/python/plotted_data.csv").open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            ident = tuple(row[name] for name in ("Time", "Tissue", "Treatment", "Taxon"))
            require(ident in indexed and ident not in csv_seen, f"Unexpected or duplicate CSV observation: {ident}")
            actual = indexed[ident]
            for csv_name, json_name in (("n_shrimp", "total"), ("n_pos", "positive"),
                                       ("prevalence_pct", "percent"), ("n_missing", "missing"),
                                       ("n_pos_observed", "observedPositive")):
                value = None if row[csv_name] == "" else float(row[csv_name])
                require(value == actual[json_name], f"CSV {csv_name} mismatch: {ident}")
            frequency = None if row["freq"] == "" else float(row["freq"])
            expected = None if actual["percent"] is None else actual["positive"] / actual["total"]
            require(frequency is None if expected is None else frequency is not None and math.isclose(frequency, expected, rel_tol=0, abs_tol=1e-9), f"CSV frequency mismatch: {ident}")
            csv_seen.add(ident)
    require(csv_seen == set(indexed), "CSV is stale or incomplete")

    if baseline is not None:
        previous = json.loads(Path(baseline).read_text())
        active = {source["time"]: source for source in sources}
        for source in previous["sources"]:
            current = active.get(source["time"])
            require(current is not None and (current["filename"], current["sha256"]) == (source["filename"], source["sha256"]), "Additive baseline changed or removed an old raw source")
        for row in previous["rows"]:
            require(indexed.get(key(row)) == row, f"Additive baseline changed or removed an old observation: {key(row)}")

    taxa, tissues, treatments = ({row[field] for row in rows} for field in ("taxon", "tissue", "treatment"))
    grid = len(taxa) * len(tissues) * len(treatments) * len(times)
    unknown = sum(row["percent"] is None for row in rows)
    return {"status": "pass", "scope": "Lineage and standardized/JSON/CSV agreement; adapter derivation, rendering, tests and CI must be verified separately.",
            "samplingOrder": times, "sourceCount": len(sources), "summaryRows": len(rows),
            "taxa": len(taxa), "tissues": len(tissues), "treatments": len(treatments),
            "knownPercentages": len(rows) - unknown, "unknownPercentages": unknown,
            "expectedCombinedGridCells": grid, "unlistedCombinations": grid - len(rows),
            "additiveBaselineChecked": baseline is not None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--expected-order", nargs="+")
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    try:
        result = audit(args.root, args.expected_order, args.baseline)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "fail", "error": str(error)}))
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
