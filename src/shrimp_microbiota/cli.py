"""Command-line entry point for the analysis pipeline."""

import argparse
import json
from pathlib import Path
import sys

from .data import DEFAULT_SOURCES
from .paths import RAW_DIR, STANDARDIZED_DIR, PYTHON_REPORTS_DIR


def main(argv=None):
    parser = argparse.ArgumentParser(prog="shrimp-heatmap", description="Standardize shrimp data, export browser data, or generate figures.")
    commands = parser.add_subparsers(dest="command", required=True)
    for name, help_text in (("standardize", "Write canonical workbooks and audit reports"),
                            ("export", "Write validated browser JSON to stdout"),
                            ("plot", "Generate Python PNG/PDF figures and CSV")):
        command = commands.add_parser(name, help=help_text)
        command.add_argument("sources", nargs="*", type=Path, help="Raw workbooks in sampling order; defaults to all four sources")
        if name != "export":
            command.add_argument("--output-dir", type=Path, default=STANDARDIZED_DIR if name == "standardize" else PYTHON_REPORTS_DIR)
    args = parser.parse_args(argv)
    sources = args.sources or [RAW_DIR / name for name in DEFAULT_SOURCES]
    if args.command == "standardize":
        from .standardization import standardize_source
        for source in sources:
            print(json.dumps(standardize_source(source, args.output_dir), indent=2))
    elif args.command == "export":
        from .dataset import export_data
        json.dump(export_data(sources), sys.stdout, ensure_ascii=True, allow_nan=False)
    else:
        from .plotting import generate_plots
        generate_plots(sources, args.output_dir)
