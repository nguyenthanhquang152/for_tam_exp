# Project layout

```text
src/shrimp_microbiota/  Installable Python analysis package
.agents/skills/        Repository workflows for future data/heatmap updates
web/src/               TypeScript, CSS, and generated-data type declaration
web/index.html         Browser document template
tests/python/          Python data, plotting, and CLI contracts
tests/unit/            Browser model tests using Node's test runner
tests/e2e/             Chromium, Firefox, and WebKit tests
scripts/               Build, preview, and verification entry points
raw/                   Original source workbooks, preserved byte-for-byte
standardized/          Canonical workbooks and provenance reports
dist/                  Self-contained browser release: heatmap.html and data.json
reports/python/        Python figures and plotted_data.csv
reports/web/           Browser-exported SVG, PNG, and PDF figures
reports/previews/      Desktop, mobile, and PDF previews
docs/reference/        Original task brief and sample image
.build/                Ignored intermediates, packages, and test diagnostics
.github/workflows/     CI for clean-checkout verification
```

`AGENTS.md` routes data-intake/release work to the project skill. Its scripts
inspect inputs and audit outputs; scientific transformations remain in the Python
package. The workflow adapts source selection and corpus-dependent tests from
new evidence rather than treating the original dataset dimensions as limits.

`raw/`, `standardized/`, `dist/`, and `reports/` are versioned scientific inputs
and reviewed deliverables. Environment directories, Python package metadata,
build intermediates, and test diagnostics are ignored.

## Dependency direction

The CLI dispatches to standardization, data export, or plotting. `data.py` owns
schema validation and display groups. `dataset.py` standardizes every raw source,
then reads only the resulting standardized workbooks. `standardization.py` owns
the common writer and aggregated-summary adapter; `day42.py` handles the raw
individual-shrimp layout. Plotting consumes the same dataset loader.

The browser renderer consumes validated JSON. It has no Python or third-party
runtime dependency. Build scripts invoke the installed Python module and bundle
the generated JSON from `.build/`; generated data is not stored under `web/src/`.
The runtime browser data validator remains the boundary between JSON and plotting.

## Configuration and entry points

Python dependencies and the `shrimp-heatmap` console command are declared in
`pyproject.toml`. `requirements.txt` installs that project in editable mode for
compatibility with pip-based setup. Frontend tooling is pinned by `package-lock.json`.

```sh
python -m shrimp_microbiota standardize
python -m shrimp_microbiota export
python -m shrimp_microbiota plot
```

`shrimp-heatmap` exposes the same commands after activating the Python environment.
`npm run standardize`, `npm run plot`, `npm run build`, and `npm test` use the
shared Python-executable selection in `scripts/runtime.mjs`.

Workspace paths are resolved centrally in `paths.py`. Commands work from the
repository or its subdirectories. Editable installations can locate their source
checkout from elsewhere; installed wheels can use `HEATMAP_ROOT` to select a
workspace containing `raw/`. `HEATMAP_PYTHON` selects a Python executable for npm
commands. No source-directory injection into `sys.path` or `PYTHONPATH` is required.

## Migration from the flat layout

| Previous location | Current location or command |
| --- | --- |
| `bacteria_data.py` | `src/shrimp_microbiota/data.py` |
| `export_web_data.py` | `python -m shrimp_microbiota export` |
| `standardize_data.py` | `python -m shrimp_microbiota standardize` |
| `standardize_day42.py` | `python -m shrimp_microbiota standardize raw/MA_42D.xlsx` |
| `plot_bacteria.py` | `python -m shrimp_microbiota plot` |
| `web/*.ts` | `web/src/*.ts` |
| `plots/` | `reports/python/` |
| `dist/exports/` | `reports/web/` |
| `dist/*preview.png` | `reports/previews/` |
| `test-results/`, `playwright-report/` | `.build/test-results/`, `.build/playwright-report/` |

The public HTML artifact remains `dist/heatmap.html`. Scientific data conventions,
sampling order, missing-value semantics, and the `raw/` and `standardized/` paths
are preserved.
