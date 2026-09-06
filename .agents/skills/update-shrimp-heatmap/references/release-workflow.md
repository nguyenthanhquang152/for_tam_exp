# Building and verifying a new heatmap version

Read current commands in `package.json`, `src/shrimp_microbiota/cli.py`, and
`.github/workflows/ci.yml`; the list below is a starting point for this checkout.
Run from the repository root. Use its installed Python environment (or
`HEATMAP_PYTHON` for npm); do not change a shared environment to point at a
temporary evaluation checkout.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e .
npm ci
```

Reuse an existing valid environment instead of recreating it. Node/Python version
requirements and pinned dependencies live in `package.json` and `pyproject.toml`.
For another workspace, `HEATMAP_ROOT` controls the analysis data root; ensure it
points at the intended checkout before generating artifacts.

## Make the source selection durable

Inspect `DEFAULT_SOURCES` and adapter dispatch before editing. Update the active
registry/order for a default release. Preserve explicit order even when lexical
filename sorting would differ. Do not auto-enroll every file found under `raw/`:
it may contain superseded versions or unselected files.

An explicit one-off build is useful for previewing selected inputs:

```sh
npm run build -- raw/source-a.xlsx raw/source-b.xlsx
```

However, `npm test` rebuilds from the defaults. For a published default update,
the registry, tests, documentation and final artifacts must agree. A green test
run against the old defaults does not verify a new preview.

## Adapt checks to the new corpus

Search, then inspect callers and assertions rather than blindly replacing numbers:

```sh
rg -n 'DEFAULT_SOURCES|DOC14|DOC28|DOC42|DOC56|560|640|160|n = 5' src tests web README.md
```

Current adaptation points include:

- `tests/python/test_sources.py`: source roster/counts, fingerprints, standardization
  equality and raw DOC42 recount. Keep the old-source checks; add independent
  checks for new measurements and derive corpus expectations from inspected data.
- `tests/python/test_plotting.py`: original DOC56 regression. Its fixed 150-row
  expectation is historical and should not be changed merely because a new day
  was added.
- `tests/python/test_cli.py`: default export size/order and workspace behavior.
- `tests/unit/model.test.mjs`: active corpus and malformed-data checks. Keep
  negative fixtures invalid as sample sizes/taxa change.
- `tests/e2e/heatmap.spec.mjs`: grid sizes, sampling labels, missing/unknown totals,
  sample annotations, filenames and export cases. Keep checks that compare every
  source-backed cell with an independently validated observation.
- `web/src/model.ts`: new sparse tissue/treatment coverage can require more
  accurate missing-combination descriptions even when the schema is unchanged.
- `web/index.html`, README: the explanatory sampling sequence or snapshot counts
  may be literal text. `web/src/app.ts`/`heatmap.ts` are mostly data-driven, but
  inspect notes, spacing, keyboard behavior and export dimensions for new shapes.

For the current renderer, a combined grid uses the taxon union × treatment union
× selected sampling times × selected tissues. The source-row count can be smaller;
unlisted combinations are not new measurements. Derive unknown and unlisted
counts separately. If the rendering contract changes, test that actual contract.

## Regenerate and inspect

Run writers sequentially because builds and tests can regenerate standardized
files and example exports:

```sh
npm run standardize
npm run plot
npm test
```

The test command includes a production build. Install the browser engines with
`npx playwright install --with-deps chromium firefox webkit` if needed; use the
existing documented local-library setup on this host rather than reinstalling it.
Keep scoped checks during development, then finish with the relevant full suite.

Verify `dist/data.json`, the standalone `dist/heatmap.html`, canonical workbooks
and reports, the Python CSV/figures, browser exports, and representative previews.
The browser tests generate many reviewed outputs in `reports/web` and
`reports/previews`; ensure new sampling states have suitable actual export cases.
Retire obsolete current-release examples explicitly or label retained historical
ones; do not leave stale previews presented as the new result.

Maintain the established presentation unless the user changes it: no numbers in
cells, one appropriate sample-size annotation, italic taxa, colored taxon groups,
dashed section/treatment rules, bold grey taxon dividers, and a fixed comparable
0–100% scale for prevalence. Check crowded day labels, new taxa, variable sample
sizes, keyboard/touch details and downloaded images, not just a screenshot of the
default view. SVG export and Canvas PNG export are different paths.
Inspect publication PDFs for transient hover/focus outlines when they are
captured from the interactive page; clear interaction state or use print styling
as appropriate before capturing a clean figure.

Use `audit_release.py` for artifact consistency. Independently recount new raw
adapters, and visually inspect exported figures. Hash agreement and unchanged
record counts alone do not prove a correct raw interpretation or a usable UI.

## Commit/push when authorized

Inspect current branch/remotes and `git diff --check`. Stage only this update's
raw/standardized inputs, code, tests, docs and intended `dist/`/`reports/` outputs.
Keep `.build/`, environments and private configuration out of the commit.
Do not create a new remote, alter repository visibility or deploy a website as
an implied part of pushing code.

After a normal commit/push, discover CI by the pushed SHA, watch that run to its
terminal result, and verify local/remote SHA equality and repository status.
Poll an existing live run instead of starting replacements because observation
timed out. If CI fails, inspect its actual failure and fix it within scope. An
auth/permission rejection needs changed credentials/authorization, not repeated
identical pushes or weaker validation.

For a local-only task, keep the same data/plot verification and omit publication.
For an additive release use a saved pre-update `dist/data.json` as the auditor's
baseline. For an explicitly requested correction/removal, review the intended
historical delta separately; the auditor's additive-baseline mode deliberately
rejects those changes.
