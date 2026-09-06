# Whiteleg shrimp bacterial heatmaps

## Interactive browser version

Open [dist/heatmap.html](dist/heatmap.html) directly in a current browser. It is
a complete offline application with embedded data, styles and JavaScript.
It needs no server, account, CDN or network connection. The
[desktop preview](dist/preview.png) shows the initial view.

Use the tissue tabs for HP, Gut or the combined view; select a red, blue or
teal sequential palette. Hover, tap or focus a cell for its percentage and
positive/total counts. Arrow keys move between cells; Home/End move within a
row, Ctrl+Home/End jump to the first/last cell, and Escape dismisses details.
The expandable data table provides the same values as text. On narrow screens,
the figure scrolls horizontally to keep taxon labels readable.

Cell numbers are hidden, the sample size appears once as a figure annotation,
and the dashed section/treatment rules and bold grey taxon divider are retained.
Zero stays white, missing records stay grey, and every palette uses the same
0–100% scale. Only presentation changes when switching palettes.

The export buttons download the selected view and palette as a self-contained
vector SVG or a PNG at three times the SVG's pixel dimensions. The combined
PNG is 4008 × 2706 pixels. Canvas uses browser-default resolution metadata;
use the pixel dimensions to set the physical size in publication software.
The existing Python PNGs below retain their explicit 300 dpi metadata.
Browser Print / Save as PDF uses a landscape figure-only layout. Example SVGs,
PNGs and a combined PDF are in [dist/exports](dist/exports).

### Rebuild or use another corrected workbook

Requires Node.js 22+ and Python 3.12+ with `requirements.txt` installed:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci
npm run build
```

The prepared `.venv` in this workspace already contains the Python dependencies.
The build automatically uses that environment; set `HEATMAP_PYTHON` to select a
different Python executable. On Windows it recognizes `.venv/Scripts/python.exe`.

```sh
npm run build -- /path/to/corrected-workbook.xlsx
npm run preview
```

Preview serves the built file at `http://127.0.0.1:4173`. Re-run the build after
source or workbook changes; preview serves the last successful build. A failed
build exits with an error and preserves the last valid HTML artifact.
Workbook replacements must use the same `summary` schema described below.
The checked-in tests intentionally verify the supplied DOC56 workbook.

### Implementation and verification

- [export_web_data.py](export_web_data.py) reuses the Python reader and group
  definitions. It exports validated counts, percentages, labels and the source
  workbook's SHA-256 fingerprint.
- [web/model.ts](web/model.ts) validates the browser data contract, rejects
  duplicate/invalid records, and defines fixed sequential color scales.
- [web/heatmap.ts](web/heatmap.ts) draws native SVG with an accessible grid.
- [web/app.ts](web/app.ts) handles controls, cell details and the HTML data table.
- [web/export.ts](web/export.ts) creates standalone SVG and Canvas PNG downloads,
  including error handling and object-URL cleanup.
- [scripts/build.mjs](scripts/build.mjs) runs strict TypeScript checking and
  esbuild, embeds all assets, and emits a content security policy with exact
  script/style hashes. The delivered page has no runtime library dependencies;
  the build/test dependencies are pinned in `package-lock.json`.

All workbook text is inserted through DOM text APIs. The generated script
escapes closing script tags, and the CSP blocks external scripts and network
data requests. The source and exported data contain the same scientific metric;
the browser does not infer bacterial density, treatment meanings or group totals.

```sh
npx playwright install --with-deps chromium firefox webkit
npm test
```

`npm test` rebuilds the app, runs the existing Python checks, runs model tests,
then tests Chromium, Firefox and WebKit. Browser checks cover every source
percentage, all tissue views and exports, PNG cell colors, keyboard navigation,
mobile layout, offline operation, accessible controls/table and export failures.
The offline check opens the standalone file while denying all HTTP(S) requests;
it also verifies that the page attempts none.
Automated accessibility checks use axe's WCAG 2/2.1 A and AA rules; these do not
replace testing with actual assistive technologies.

Verified on 2026-09-06: strict TypeScript build, Python checks of all 150 source
values, four model tests and all 21 browser tests passed. The browser runs used
Chromium 153, Firefox 155 and WebKit 26.6. Automated accessibility scans reported
no WCAG A/AA violations in the tested desktop view with the data table expanded.

On this host, WebKit's missing `libavif16`, `libgav1-1` and `libyuv0` were
extracted into `.browser-libs` without changing system packages. The test
configuration uses that path for dependency checks; the libraries are also
linked into the installed Playwright WPE browser's `sys/lib` directory because
its launcher sets its own library search path.
On other hosts, Playwright's standard `install --with-deps` command installs the
required browser libraries. Failed browser tests retain traces and an HTML
report under `playwright-report`.

## Python plots

```sh
python -m pip install -r requirements.txt
python plot_bacteria.py MA_56D_R_corrected.xlsx --output-dir plots
```

Use Python 3.12 or newer with these dependency versions. In this workspace,
the prepared environment can run the script with `.venv/bin/python plot_bacteria.py`.

The script creates 300 dpi PNGs and PDFs for HP, Gut, and both tissues
side by side. `plots/plotted_data.csv` contains all 150 source records and the
exact percentages used in the heatmaps. Run `.venv/bin/python test_plot_bacteria.py`
for the data and plotting checks.

## What the workbook measures

The `summary` sheet contains 15 taxa × 5 treatments (F0, F15, F25, F35, F50)
× 2 tissues (HP and Gut), all at DOC56. Each treatment/tissue has 5 shrimp.
Here HP is interpreted as hepatopancreas, consistent with the reference's context.

Each cell's color represents **shrimp positive (%) = 100 × n_pos / n_shrimp = 100 × freq**.
For example, *Vibrio tubiashii* in HP/F0 is 5/5 = 100%; *Bacillus altitudinis*
in HP/F0 is 0/5 = 0%. These are detection prevalences. The workbook contains
neither bacterial-density measurements (such as CFU/g) nor per-shrimp abundance
counts. Multiple taxa may occur in the same shrimp, so percentages across taxa
need not sum to 100. Normalizing these frequencies to sum to 100 would change
the meaning of the data.

## Matching sample.jpeg

The plots retain its white-to-red 0–100 scale, italic taxon names, colored taxon
section headings, treatment columns, and dashed section separators extending
through the group labels. Dashed vertical lines separate treatment columns.
A bold grey vertical divider marks the boundary beside the taxon-label column.
Cells have no numeric annotations; the sample size appears once below the
figure as `n = 5 shrimp per treatment and tissue.` They use
the actual workbook's taxa, five treatment codes and DOC56 time point. The
reference's Normal/Prebiotic/Probiotic/Synbiotic labels, days 3/7/14 after
infection and individual-shrimp columns are not present in this workbook and
cannot be reconstructed from its summaries.

The visual groups follow the reference: Vibrio/Photobacterium/Shewanella,
Bacillus/Lactobacillus, then all remaining genera. These are display groups,
not formal taxonomic ranks. Group headings have no aggregate heatmap values:
the number of shrimp positive for any taxon in a group cannot be inferred
without knowing which taxa co-occur in each shrimp.

Zero is white; an absent taxon/treatment record is gray.
The script checks unique records, positive integer sample sizes, integer
positive counts within bounds, consistent sample sizes within each cohort,
and agreement between `freq` and the counts before rendering.
