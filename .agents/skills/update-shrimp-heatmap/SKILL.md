---
name: update-shrimp-heatmap
description: "Integrate new or corrected raw workbooks into this whiteleg-shrimp microbiota project, standardize them, regenerate and validate heatmaps, and commit/push when requested. Use for dataset additions, source-format changes, or heatmap releases in for_tam_exp; not generic chart design or unrelated repositories."
---

# Update Shrimp Heatmap

Turn the user's supplied sources into a reproducible heatmap release using this
repository's existing Python/TypeScript pipeline. Adapt to the actual workbooks
and current checkout; neither a filename nor a previous dataset count is a schema.

## Establish the update

- Locate the Git root and inspect its `AGENTS.md`, `README.md`,
  `docs/architecture.md`, current branch/status/remotes, and relevant source/test
  code. This skill may be installed outside the repository; commands below run
  from the target repository root.
- Identify the supplied files, intended source order, whether they add or replace
  a sampling period, and the requested outputs/publication scope. Use explicit
  user order; otherwise inspect sampling labels and clarify material ambiguity.
- Record the current `dist/data.json` and raw hashes before making an addition.
  Preserve unrelated dirty work and later-arriving files outside the update.

## Inspect and integrate sources

1. Profile the incoming workbooks with `scripts/inspect_sources.py` in this skill
   directory. Inspect headers, sheets, merged identifiers, counts, zeros, blanks,
   and units. Profiling is read-only and its preview is not a complete validation.
2. Store originals in `raw/` and verify their bytes. Copy external inputs; move
   loose project inputs when appropriate. Do not overwrite a different raw file
   with the same name: retain a versioned original or resolve the collision.
3. Read [source-contract.md](references/source-contract.md) when mapping columns,
   interpreting missing values, or adding an adapter. Reuse the summary adapter
   for compatible summaries; implement a bounded adapter only for a demonstrated
   different layout. Do not route a new individual-shrimp sheet through the
   DOC42 adapter just because it looks similar.
4. Update the live source selection/order (currently `DEFAULT_SOURCES` in
   `src/shrimp_microbiota/data.py`) when the user wants the new dataset to become
   the default. Inspect `standardization.py` dispatch, `dataset.py`, and
   `web/src/model.ts` for actual contract changes. Explicit CLI source arguments
   are suitable for an isolated preview; they do not update the default release.
5. Standardize **every active source** into `standardized/`, then load only those
   standardized files for plots. Keep raw/standardized hashes, conversion rules,
   per-source reports, and sufficient cell/sample evidence to recount a new raw
   adapter independently. Never edit a generated workbook as the lasting fix.

Preserve the current scientific meaning unless the user explicitly changes it:
`100 * n_pos / n_shrimp` is detection prevalence. Blanks and unlisted taxa are
unknown, not zero; incomplete measurements retain observed positives separately.
Do not merge distinct species or infer treatment meanings. If a new format's
denominator, units, sample identity, or meaning of a marker is unresolved, keep
the affected values unknown when the contract can represent that accurately;
otherwise complete independent work and request the missing information before
deriving or publishing those percentages.

## Rebuild and verify

Read [release-workflow.md](references/release-workflow.md) for commands, test
adaptation, exports, and publication checks. In particular:

- Reconcile corpus-dependent tests/docs with evidence from the supplied data.
  Keep historical source-level regression checks. Never replace a failed check
  with a number copied solely from the generated heatmap.
- Derive source/taxa/tissue/treatment counts and expected grid cells from the
  actual selected dataset; do not assume four files, 560 records, 16 taxa, five
  shrimp, or the current treatment codes for future inputs.
- Run standardization, plotting, build, and test commands sequentially when they
  write the same generated files. Verify actual SVG/PNG/PDF exports and inspect
  layout, chronological labels, zero/unknown distinctions, and cell details.
- Run this skill's `scripts/audit_release.py --root .` for hash/data/CSV agreement.
  For an additive update, `--baseline <saved-data.json>` also checks that old
  records and raw sources are preserved. It does not validate a new adapter's
  raw interpretation or replace the browser/independent recount tests.

## Deliver and publish

Finish the local, reviewable artifacts and checks before publication. Use current
user/session authorization: this skill itself does not grant GitHub write access.
When commit/push is requested or already authorized for this update, inspect the
diff, stage only the intended source/code/tests/skill/docs/artifacts, commit, and
push to the verified branch/remote without force. Follow the repository's actual
branch/PR rules rather than assuming `main` forever.

Verify CI for the pushed commit and local/remote SHA equality. Diagnose concrete
failures and repair within scope; do not retry an identical authentication or
permission rejection, bypass branch protection, or overwrite unrelated remote
history. If an external prerequisite prevents publishing, leave the validated
local result intact and state the exact unresolved step. Do not report a queued
run, an inspection preview, or a past green run as current completion.

Close with the heatmap/standardized-data links, source order, unresolved data
uncertainties, validation evidence, commit/CI status, and any preserved unrelated
local work. For a local-only request, stop at the validated local deliverables.
