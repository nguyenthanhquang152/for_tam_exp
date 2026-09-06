"""Workspace data paths, independent of the installed package location."""

import os
from pathlib import Path
import tomllib


def project_root():
    if os.environ.get("HEATMAP_ROOT"):
        return Path(os.environ["HEATMAP_ROOT"]).expanduser().resolve()
    cwd = Path.cwd()
    for directory in (cwd, *cwd.parents, *Path(__file__).resolve().parents):
        marker = directory / "pyproject.toml"
        if marker.is_file():
            with marker.open("rb") as file:
                if tomllib.load(file).get("project", {}).get("name") == "shrimp-microbiota":
                    return directory
    return cwd


ROOT_DIR = project_root()
RAW_DIR = ROOT_DIR / "raw"
STANDARDIZED_DIR = ROOT_DIR / "standardized"
PYTHON_REPORTS_DIR = ROOT_DIR / "reports/python"
