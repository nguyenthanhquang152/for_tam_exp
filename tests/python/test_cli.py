"""Installed-package and workspace-boundary checks for the public CLI."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

from shrimp_microbiota.data import DEFAULT_SOURCES
from shrimp_microbiota.paths import ROOT_DIR


class CliTest(unittest.TestCase):
    def test_help_and_invalid_command_outside_repository(self):
        with TemporaryDirectory() as folder:
            result = subprocess.run([sys.executable, "-m", "shrimp_microbiota", "--help"], cwd=folder, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("standardize", result.stdout)
            self.assertIn("export", result.stdout)
            result = subprocess.run([sys.executable, "-m", "shrimp_microbiota", "invalid"], cwd=folder, capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)

    def test_export_into_an_explicit_data_workspace(self):
        with TemporaryDirectory() as folder:
            workspace = Path(folder)
            shutil.copytree(ROOT_DIR / "raw", workspace / "raw")
            env = {**os.environ, "HEATMAP_ROOT": str(workspace)}
            result = subprocess.run([sys.executable, "-m", "shrimp_microbiota", "export"], cwd=folder, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(result.stdout)
            self.assertEqual([source["filename"] for source in data["sources"]], list(DEFAULT_SOURCES))
            self.assertEqual(len(data["rows"]), 560)
            self.assertEqual(len(list((workspace / "standardized").glob("*.xlsx"))), 4)
            self.assertEqual(len(list((workspace / "raw").glob("*.xlsx"))), 4)


if __name__ == "__main__":
    unittest.main()
