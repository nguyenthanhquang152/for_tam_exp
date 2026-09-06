# Source interpretation and adapter decisions

Read the current `src/shrimp_microbiota/data.py`, `standardization.py`, `day42.py`,
and `dataset.py` as implementation authority. These paths are repository-relative.
This document describes the established contract, not permission to reinterpret
new data or a substitute for inspecting it.

## Canonical summary

The current standardized `summary` columns, in order, are:

| Field | Meaning |
| --- | --- |
| `Time` | User/source-supported sampling label, such as DOC56 |
| `Tissue` | Tissue identifier; the existing display maps HP to hepatopancreas |
| `Taxon` | Taxon name with surrounding whitespace removed |
| `Phylum` | Source phylum label, whitespace normalized |
| `Treatment` | Source treatment code, without inferred clinical meaning |
| `n_shrimp` | Positive integer cohort size |
| `n_pos` | Integer positive count when fully observed; null when incomplete |
| `freq` | `n_pos / n_shrimp` when fully observed; null when incomplete |
| `n_missing` | Missing measurement count, from zero through cohort size |
| `n_pos_observed` | Known positive measurements, at most `n_shrimp - n_missing` |

Keys are `(Time, Tissue, Taxon, Treatment)`. Source times are currently unique
across the selected workbooks. Sample size must agree within a time/tissue/
treatment cohort; if a genuinely different experimental design needs per-taxon
denominators, change and validate that contract deliberately rather than hiding
the mismatch. Complete summaries have `n_missing = 0` and
`n_pos_observed = n_pos`. Never fill a missing frequency with zero to pass parsing.

### Choose the smallest valid route

- **Existing summary schema:** Map/trim labels and canonicalize columns, preserving
  supplied counts and frequencies. The existing adapter already handles different
  column order. Inspect any validation/audit sheets in the raw file.
- **Individual measurements:** Establish the sample roster, identifier scope,
  tissue/treatment mapping, measurement meaning, and blank convention. Repeated
  readings of one shrimp are not additional shrimp. Repeated identical values
  from different identified shrimp are not duplicates. Recount positives against
  independently identified samples, not colony totals.
- **Another layout or metric:** Inspect it first. Do not infer a denominator from
  a familiar filename, copy another day's values, sum percentages across taxa,
  normalize prevalence columns to 100%, or treat a transfer of file format as a
  change of scientific quantity. Use an explicit adapter and focused raw-derived
  checks when the mapping is established.

The DOC42 adapter is specific: `Sheet1`, three header rows, merged treatment/
shrimp identifiers, organ `G` mapped to `Gut`, and an inspected five-treatment,
five-shrimp roster. It currently dispatches by the exact filename `MA_42D.xlsx`.
Its `measurement > 0` rule produces detection prevalence; dilution does not
change presence/absence. Its exact roster, labels and layout are **not defaults
for a new file**. A new adapter should declare how its own source establishes
sampling time and preserve raw cell coordinates/measurements when available.

## Missing data and identity

Keep these distinct through standardized Excel, JSON, CSV, chart colors,
tooltips, and the data table:

1. Explicit zero detections: known 0%, white in the established palettes.
2. An incomplete taxon/cohort measurement set: unknown percentage, known total
   and observed positives retained, grey in the chart.
3. An unreported taxon/tissue/treatment/time combination: no observation, not an
   invented zero. This may mean an unlisted taxon or an unsampled cohort. A taxon
   reported under F0 is not necessarily absent from the entire source when F15
   was never sampled. Check cell-details and table wording for this distinction.

Sample-size annotations must describe sampled cohorts. Do not imply that an
unmeasured treatment/tissue combination had the denominator observed elsewhere.

If the user confirms that a particular marker means zero, document that scoped
decision in its adapter/report and test it. Do not transfer the interpretation
to unrelated sources. Do not merge distinct species just to align rows; use the
union of actual names. For example, `Ruegeria arenilitoris` and `Ruegeria profundi`
are deliberately separate. Do not infer whether animals are paired across days
from summary files that lack individual identities.

## Existing snapshot, not future constraints

The original selected sequence is MA_D14_R.xlsx → MA_28D_R.xlsx → MA_42D.xlsx →
MA_56D_R_corrected.xlsx. It contains 130/140/140/150 summary rows, respectively;
16 taxa in the union; 28 raw DOC42 blanks affecting 25 percentages. The combined
grid has 640 cells because it expands the taxon union across the selected
times, treatments and tissues. Preserve these facts as historical regression
evidence when adding data; derive new corpus totals separately.

A corrected source may replace an active source for the same sampling time.
Keep the original raw file and record which version is active. The current
one-time-per-source uniqueness rule means selecting both versions is not a
valid way to publish a correction.
