# Whiteleg shrimp bacterial heatmaps

Open [dist/heatmap.html](dist/heatmap.html) in a browser. The application works
offline with its data, styles and JavaScript embedded. No server or account is
required. [Desktop preview](reports/previews/preview.png) · [Example exports](reports/web)

## Project structure

Python analysis code lives in `src/shrimp_microbiota/`; browser source is in
`web/src/`. Tests are separated into `tests/python/`, `tests/unit/`, and
`tests/e2e/`. Figures and previews live in `reports/`, while `dist/` contains
only the standalone browser release. See [architecture and migration notes](docs/architecture.md).

Use `npm run standardize` and `npm run plot` for the analysis commands.
`npm test` builds the app and runs Python, model, and browser checks.
The [CI workflow](.github/workflows/ci.yml) runs the same checks on pushes and pull requests.

## Reusable agent workflow

Use the repository skill
[`$update-shrimp-heatmap`](.agents/skills/update-shrimp-heatmap/SKILL.md) when adding
or correcting raw data and producing the next heatmap version. `AGENTS.md` routes
those tasks to the skill. It covers source inspection, adapter selection,
canonicalization, source-order updates, evidence-based test adaptation, plot
verification and authorized commit/push with CI monitoring.

Example request (replace the filename and sampling order with the actual inputs):

```text
Use $update-shrimp-heatmap to add raw/new_sampling.xlsx after DOC56,
preserve the existing measurements, rebuild and validate all heatmap views,
then commit and push to the configured remote.
```

For a preview only, explicitly request a local release without commit/push. The
skill respects that scope. It inspects the current source registry and tests;
it does not assume that a future dataset still has four files or five shrimp.

Two read-only helpers support the workflow:

```sh
.venv/bin/python .agents/skills/update-shrimp-heatmap/scripts/inspect_sources.py raw/new_sampling.xlsx
.venv/bin/python .agents/skills/update-shrimp-heatmap/scripts/audit_release.py --root .
```

The inspector shows workbook structure without modifying it. The auditor derives
current counts and checks raw/standardized fingerprints plus JSON/CSV agreement;
an optional additive baseline checks preservation of prior records. Neither
helper replaces independent raw-data checks or rendered-output validation.

The skill uses Codex's [repository skill discovery](https://learn.chatgpt.com/docs/build-skills#where-to-save-skills)
and is versioned with this project for future checkouts.

The workflow was forward-tested in an isolated checkout with a synthetic DOC70
source, a new taxon, a different sample size, and sparse treatment coverage.
It produced validated local outputs while preserving the original observations
and respecting the explicit no-publication boundary. Synthetic evaluation data
is not part of this repository's experimental dataset.

## Sources and chronological order

The default heatmap includes every source in this order. Within each treatment,
columns run **DOC14 → DOC28 → DOC42 → DOC56**. Tissue controls select HP, Gut,
or both; the sampling selector offers all days or an individual day.

| Raw source | Standardized source | Sampling | Taxa listed | Summary rows | Unknown percentages |
| --- | --- | --- | ---: | ---: | ---: |
| [MA_D14_R.xlsx](raw/MA_D14_R.xlsx) | [DOC14](standardized/MA_D14_R_standardized.xlsx) | DOC14 | 13 | 130 | 0 |
| [MA_28D_R.xlsx](raw/MA_28D_R.xlsx) | [DOC28](standardized/MA_28D_R_standardized.xlsx) | DOC28 | 14 | 140 | 0 |
| [MA_42D.xlsx](raw/MA_42D.xlsx) | [DOC42](standardized/MA_42D_standardized.xlsx) | DOC42 | 14 | 140 | 25 |
| [MA_56D_R_corrected.xlsx](raw/MA_56D_R_corrected.xlsx) | [DOC56](standardized/MA_56D_R_corrected_standardized.xlsx) | DOC56 | 15 | 150 | 0 |

The combined dataset has **560 summary records and 16 distinct taxa**. Every
view uses the same taxon rows. The all-days, both-tissues view has 640 cells:
535 known percentages, 25 incomplete percentages, and 80 combinations whose
taxon is not listed in that source. Missing is never converted to zero.

Names are trimmed of surrounding whitespace. Different species remain distinct:
DOC14's *Ruegeria arenilitoris* is not merged with *Ruegeria profundi* from later
days. *Micrococcus luteus* is only listed in DOC56. The original four workbooks
are preserved byte-for-byte in `raw/`; raw and standardized SHA-256 fingerprints are included in
[dist/data.json](dist/data.json).

## Standardizing every source

[standardization.py](src/shrimp_microbiota/standardization.py) generates all four workbooks in
`standardized/`. Each has the same ten summary columns, deterministic row order,
header styling, and `validation_check`, `issues_if_any`, and `normalization_notes`
sheets. DOC42 additionally retains its 700 individual measurement records.

The common schema is `Time, Tissue, Taxon, Phylum, Treatment, n_shrimp, n_pos,
freq, n_missing, n_pos_observed`. For the existing DOC14, DOC28 and DOC56 summaries,
standardization trims label whitespace, orders columns/rows, and adds explicit
missing-data fields while preserving counts and frequencies. Original audit
sheets remain available in the untouched raw files.

Both the browser build and Python plots run standardization first and then read
**only the standardized workbooks**. Every workbook has a matching `.report.json`
with raw/standardized paths, fingerprints, transformation method and row counts.
Identical inputs and rules produce identical workbook bytes; generated archive
metadata timestamps are fixed for reproducibility, independent of sampling dates.

```sh
.venv/bin/python -m shrimp_microbiota standardize
```

## Day-42 standardization

[day42.py](src/shrimp_microbiota/day42.py) produces
[standardized/MA_42D_standardized.xlsx](standardized/MA_42D_standardized.xlsx)
before the heatmap reads day 42. The workbook includes:

- `summary`: the common eight columns, plus `n_missing` and `n_pos_observed`.
- `validation_check`: taxon counts, sample sizes and incomplete summaries.
- `issues_if_any`: the coordinates of all 28 blank measurements.
- `raw_observations`: all 700 measurements with their original cell coordinates,
  shrimp identifiers, tissues, treatments and dilution values.
- `normalization_notes`: source fingerprint and conversion rules.

The raw sheet has 50 shrimp–tissue rows: five shrimp for each of five treatments,
with Gut and HP samples, and 14 taxon measurements per row. Treatment and shrimp
identifiers are resolved from actual Excel merged ranges; `G` becomes `Gut`.
A value greater than zero counts as a detection. Dilution is retained for audit
but does not change this presence/absence calculation. Duplicate identifiers,
invalid values or an incomplete sample roster cause validation to fail.

**Blanks are missing measurements.** If any of a taxon's five measurements is
blank, its `n_pos` and `freq` stay empty and its percentage is unknown. The number
of positive measurements actually observed remains in `n_pos_observed`.
For example, DOC42/HP/F0/*Vibrio jasicida* has four known positive measurements
and one blank, so its percentage is unknown, not 80% or 100%.

The 28 blanks affect 25 summaries. A machine-readable count report accompanies
the workbook at
[standardized/MA_42D_standardized.report.json](standardized/MA_42D_standardized.report.json).

```sh
.venv/bin/python -m shrimp_microbiota standardize raw/MA_42D.xlsx
```

## Reading and exporting the figure

Color represents **shrimp positive (%) = 100 × n_pos / n_shrimp = 100 × freq**
when all measurements are known. Each treatment/tissue has five shrimp at each
sampling day. These are detection prevalences, not bacterial densities or
relative abundances. Several taxa can occur in one shrimp, so percentages across
taxa need not sum to 100. Group totals and individual-shrimp profiles cannot be
reconstructed from the summary files.

The plots keep the reference's colored group headings, italic taxon names,
dashed section/treatment separators and bold grey taxon divider. Cells have no
numeric labels. The sample size is a figure annotation. White is zero; grey
means incomplete measurements or a taxon not listed in that source. Hover,
tap, keyboard focus or the data table explains which situation applies.

All palettes retain a fixed 0–100% scale. Arrow keys move between cells,
Home/End move within a row, Ctrl+Home/End jump to the first/last cell, and Escape
dismisses details. Narrow screens scroll horizontally; the expandable table
also exposes exact values, observed positives and missing-measurement counts.

Download SVG for a self-contained vector figure, or PNG for an image at three
times the SVG pixel dimensions. Browser PNG exports use browser-default
resolution metadata; use the pixel dimensions to choose the physical size in
publication software. Browser Print / Save as PDF uses a landscape figure-only
layout. The Python PNGs retain explicit 300 dpi metadata.

The visual taxon groups follow the reference (Vibrio/Photobacterium/Shewanella,
Bacillus/Lactobacillus, then other genera); these are display groups, not formal
taxonomic ranks. HP is interpreted as hepatopancreas. Treatment codes and DOC
sampling labels are retained from the supplied sources.

## Build and run

Requires Node.js 22+ and Python 3.12+:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e .
npm ci
npm run build
npm run preview
```

The Python package supplies the `shrimp-heatmap` command and `python -m shrimp_microbiota`. The prepared `.venv` in this workspace contains the installed package.
The build uses it automatically; `HEATMAP_PYTHON` can select a different Python
executable. Windows environments at `.venv/Scripts/python.exe` are recognized.
Preview serves `http://127.0.0.1:4173`. Rebuild after changing code or workbooks;
a failed build leaves the last successful HTML file intact.

The default build loads the four sources listed above. Explicit source arguments
are loaded in the order supplied; each must have one distinct sampling time:

```sh
npm run build -- raw/MA_D14_R.xlsx raw/MA_28D_R.xlsx raw/MA_42D.xlsx raw/MA_56D_R_corrected.xlsx
.venv/bin/python -m shrimp_microbiota plot
```

The Python command uses the same loader and writes 300 dpi PNG/PDF figures for
each day in HP, Gut and combined views, plus all 560 records in
[reports/python/plotted_data.csv](reports/python/plotted_data.csv). It also accepts an explicit
list of workbook paths and `--output-dir`. Example for one source:

```sh
.venv/bin/python -m shrimp_microbiota plot raw/MA_56D_R_corrected.xlsx --output-dir /tmp/doc56-plots
```

## Implementation and verification

- [data.py](src/shrimp_microbiota/data.py): shared schema validation and taxon groups.
- [standardization.py](src/shrimp_microbiota/standardization.py): canonical workbooks and audit reports for every source.
- [day42.py](src/shrimp_microbiota/day42.py): auditable raw-data conversion.
- [dataset.py](src/shrimp_microbiota/dataset.py): ordered source loading and version-2
  browser data with source fingerprints and explicit missing measurements.
- [web/src/model.ts](web/src/model.ts): browser validation and sequential palettes.
- [web/src/heatmap.ts](web/src/heatmap.ts): SVG rendering keyed by sampling time, taxon,
  tissue and treatment, with aligned taxon rows across views.
- [web/src/app.ts](web/src/app.ts): controls, accessible details and data table.
- [web/src/export.ts](web/src/export.ts): SVG and Canvas PNG downloads with error handling.
- [scripts/build.mjs](scripts/build.mjs): strict TypeScript checking, esbuild and
  a standalone HTML artifact with exact script/style hashes in its CSP.

Workbook labels are inserted through DOM text APIs. The bundled script escapes
closing script tags, and the CSP blocks external scripts and network data
requests. Runtime code has no third-party library dependencies; build and test
dependencies are pinned in `package-lock.json`.

```sh
npx playwright install --with-deps chromium firefox webkit
npm test
```

Tests rebuild the application, retain the original DOC56 regression checks,
independently recount all 700 day-42 measurements, compare all source summaries,
verify all standardized schemas and byte-stable rebuilds, and test browser values, chronological ordering, unknown/absent/zero semantics,
all sampling controls, keyboard/touch interactions and SVG/PNG exports. PNG
checks compare cell-center pixels with their SVG colors. Offline tests deny
all HTTP(S) requests while opening the standalone file.

Accessibility checks use axe's WCAG 2/2.1 A and AA rules with the data table
expanded. Automated checks do not replace testing with actual assistive
technologies. Browser failures retain traces and an HTML report in
`.build/playwright-report`.

Verified on 2026-09-06: the Python data/plotting contracts, four model tests, and all 24
browser tests passed across Chromium, Firefox and WebKit, including the expanded
data table's automated accessibility scan. All 560 source summaries and all 700
raw day-42 measurements were checked.

On this host, WebKit libraries `libavif16`, `libgav1-1` and `libyuv0` were
extracted under `.browser-libs` and linked into Playwright WPE's `sys/lib`
directory without changing system packages. On other hosts, Playwright's
standard `install --with-deps` command installs the required libraries.
